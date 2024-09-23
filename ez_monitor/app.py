from flask import Flask, render_template, jsonify, request
import psutil
import time
import os
import cpuinfo
import shutil
import GPUtil
import sys
import platform
from functools import lru_cache
from threading import Thread, Lock
import argparse
import socket
import requests
import logging
import docker
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import importlib
import subprocess

# Conditionally import Windows-specific modules
if platform.system() == 'Windows':
    import win32process
    import win32api
    import win32con
    import pywintypes

# Set up logging at the module level
logging.basicConfig(level=logging.WARNING, format='%(asctime)s | %(levelname)-6s | %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global variables
metrics = {
    'cpu': {}, 'memory': {}, 'disk': {}, 'gpu': {}, 'disk_io': {}, 'network': {}
}
metrics_lock = Lock()
config = {
    'refresh_rate': 2,
    'max_data_points': 1800
}

# Add this global variable to store the last update time
last_update_time = None

# Add this global variable
last_metrics_update = {}

# Add this global variable to store metric collection times
metric_collection_times = {}

# CPU Information
@lru_cache(maxsize=1)
def get_static_cpu_info():
    cpu_info = cpuinfo.get_cpu_info()
    return {
        'count': psutil.cpu_count(),
        'name': cpu_info['brand_raw'],
    }

def get_cpu_info():
    static_info = get_static_cpu_info()
    cpu_times_percent = psutil.cpu_times_percent(interval=None)
    dynamic_info = {
        'usage': psutil.cpu_percent(interval=None),
        'frequency': f"{psutil.cpu_freq().current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': psutil.cpu_count(logical=True),
        'running': sum(1 for p in psutil.process_iter(['status']) if p.info['status'] == psutil.STATUS_RUNNING),
        'load_average': get_load_average(),
        'user': cpu_times_percent.user,
        'system': cpu_times_percent.system,
        'idle': cpu_times_percent.idle,
    }
    return {**static_info, **dynamic_info}

def get_load_average():
    if hasattr(os, 'getloadavg'):
        load_avg = os.getloadavg()
        return f"{load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}"
    return "N/A"

# Memory Information
def get_memory_info():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    total_gb = mem.total / (1024 ** 3)
    used_gb = mem.used / (1024 ** 3)
    
    memory_info = {
        'total': f"{total_gb:.2f}",
        'used': f"{used_gb:.2f}",
        'percent': mem.percent,
        'available': f"{mem.available / (1024 ** 3):.2f}",
        'swap_total': f"{swap.total / (1024 ** 3):.2f}",
        'swap_used': f"{swap.used / (1024 ** 3):.2f}",
        'swap_percent': swap.percent
    }
    
    if hasattr(mem, 'cached'):
        memory_info['cached'] = f"{mem.cached / (1024 ** 3):.2f}"
    if hasattr(mem, 'buffers'):
        memory_info['buffers'] = f"{mem.buffers / (1024 ** 3):.2f}"
    
    return memory_info

# Disk Information
def get_static_disk_info():
    partitions = psutil.disk_partitions()
    static_disk_info = {}
    for partition in partitions:
        try:
            static_disk_info[partition.mountpoint] = {
                'device': partition.device,
                'mountpoint': partition.mountpoint,
                'fstype': partition.fstype,
                'opts': partition.opts,
                'remote': 'remote' in partition.opts
            }
        except Exception as e:
            logger.error(f"Error getting static disk info for {partition.mountpoint}: {e}")
    return static_disk_info

def get_disk_info(path='/'):
    try:
        usage = shutil.disk_usage(path)
        total_gb = usage.total / (1024 ** 3)
        used_gb = usage.used / (1024 ** 3)
        free_gb = usage.free / (1024 ** 3)
        
        percent = (usage.used / usage.total) * 100
        
        return {
            'total': f"{total_gb:.2f} GB",
            'used': f"{used_gb:.2f} GB",
            'free': f"{free_gb:.2f} GB",
            'percent': round(percent, 1),
        }
    except Exception as e:
        logger.error(f"Error getting disk info: {e}")
        return {
            'total': "N/A", 'used': "N/A", 'free': "N/A", 'percent': 0,
        }

# GPU Information
def get_gpu_info():
    try:
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]  # Get the first GPU
            return {
                'name': gpu.name,
                'percent': gpu.load * 100,
                'memory_used': f"{gpu.memoryUsed} MB",
                'memory_total': f"{gpu.memoryTotal} MB",
                'temperature': gpu.temperature,
                'driver': gpu.driver,
            }
        else:
            return {'error': 'No GPU found'}
    except Exception as e:
        logger.error(f"Error getting GPU info: {e}")
        return {'error': str(e)}

# Disk I/O and Network Usage
def get_disk_io():
    try:
        if platform.system() == 'Windows':
            io_counters = psutil.disk_io_counters()
            logger.debug(f"Windows disk I/O: {io_counters}")
            disk_info = {
                'read_bytes': io_counters.read_bytes,
                'write_bytes': io_counters.write_bytes,
                'read_count': io_counters.read_count,
                'write_count': io_counters.write_count,
            }
        else:  # Linux and other Unix-like systems
            io_counters = psutil.disk_io_counters(perdisk=True)
            disk_info = {
                'read_bytes': sum(disk.read_bytes for disk in io_counters.values()),
                'write_bytes': sum(disk.write_bytes for disk in io_counters.values()),
                'read_count': sum(disk.read_count for disk in io_counters.values()),
                'write_count': sum(disk.write_count for disk in io_counters.values()),
            }
        
        # Add filesystem type information
        partitions = psutil.disk_partitions()
        if partitions:
            disk_info['filesystem'] = partitions[0].fstype
        else:
            disk_info['filesystem'] = 'Unknown'
        
        return disk_info
    except Exception as e:
        logger.error(f"Error getting disk I/O info: {e}")
        return {
            'read_bytes': 0,
            'write_bytes': 0,
            'read_count': 0,
            'write_count': 0,
            'filesystem': 'Unknown'
        }

def get_network_usage():
    net_counters = psutil.net_io_counters()
    return {
        'bytes_sent': net_counters.bytes_sent,
        'bytes_recv': net_counters.bytes_recv,
        'packets_sent': net_counters.packets_sent,
        'packets_recv': net_counters.packets_recv,
    }

# Network Information
def get_static_network_info():
    interfaces = {}
    try:
        hostname = socket.gethostname()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
        except:
            local_ip = "Unable to retrieve"
        try:
            public_ip = requests.get('https://api.ipify.org').text
        except:
            public_ip = "Unable to retrieve"

        interfaces['general'] = {
            'hostname': hostname,
            'local_ip': local_ip,
            'public_ip': public_ip
        }

        for interface, addrs in psutil.net_if_addrs().items():
            interfaces[interface] = {
                'mac': next((addr.address for addr in addrs if addr.family == psutil.AF_LINK), 'Unknown'),
                'ipv4': next((addr.address for addr in addrs if addr.family == socket.AF_INET), 'Unknown'),
                'ipv6': next((addr.address for addr in addrs if addr.family == socket.AF_INET6), 'Unknown')
            }
    except Exception as e:
        logger.error(f"Error getting network info: {e}")
    return interfaces

# Add this function to get Docker container information
def is_docker_available():
    try:
        importlib.import_module('docker')
        return True
    except ImportError:
        return False

def is_docker_running():
    system = platform.system()
    try:
        if system == "Linux":
            # Check if Docker daemon is running on Linux
            subprocess.run(["docker", "info"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Windows":
            # Check if Docker daemon is running on Windows
            subprocess.run(["docker", "info"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        else:
            logger.warning(f"Unsupported operating system: {system}")
            return False
        return True
    except subprocess.CalledProcessError:
        return False
    except FileNotFoundError:
        logger.warning("Docker command not found. Is Docker installed?")
        return False

def get_docker_containers(limit=10):
    if not is_docker_running():
        logger.info("Docker is not running")
        return None

    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        
        if containers is None:
            logger.warning("Docker client returned None for container list")
            return []

        container_info = []
        for container in containers[:limit]:
            try:
                stats = container.stats(stream=False)
                
                # Check if stats is None or empty
                if not stats:
                    logger.warning(f"No stats available for container {container.id}")
                    continue

                # CPU usage calculation with fallback for Windows
                cpu_percent = 0
                try:
                    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stats['cpu_stats'].get('system_cpu_usage', 0) - stats['precpu_stats'].get('system_cpu_usage', 0)
                    if system_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage']['percpu_usage']) * 100
                except KeyError:
                    # Fallback for Windows or if keys are missing
                    cpu_percent = stats['cpu_stats']['cpu_usage']['total_usage'] / 10000000  # Rough estimate

                # Memory usage calculation
                mem_usage = stats['memory_stats'].get('usage', 0)
                mem_limit = stats['memory_stats'].get('limit', 1)
                mem_percent = (mem_usage / mem_limit) * 100 if mem_limit > 0 else 0

                # Network I/O calculation
                net_io = stats.get('networks', {}).get('eth0', {'rx_bytes': 0, 'tx_bytes': 0})
                
                # Block I/O calculation
                blk_io = stats.get('blkio_stats', {}).get('io_service_bytes_recursive', [])
                if blk_io is not None:
                    blk_read = sum(item['value'] for item in blk_io if item.get('op') == 'Read')
                    blk_write = sum(item['value'] for item in blk_io if item.get('op') == 'Write')
                else:
                    blk_read = blk_write = 0

                # Get detailed container info
                container_details = container.attrs
                
                # Determine the status
                status = container.status
                if status == 'running':
                    health = container_details.get('State', {}).get('Health', {}).get('Status')
                    if health:
                        status = health  # This will be 'healthy', 'unhealthy', or 'starting'
                
                container_info.append({
                    'id': container.id,  # Full container ID
                    'short_id': container.short_id,
                    'name': container.name,
                    'status': status,
                    'image': container.image.tags[0] if container.image.tags else 'N/A',
                    'cpu_percent': round(cpu_percent, 2),
                    'mem_percent': round(mem_percent, 2),
                    'mem_usage': f"{mem_usage / (1024 * 1024):.2f}MB",
                    'mem_limit': f"{mem_limit / (1024 * 1024):.2f}MB",
                    'net_io': f"{net_io['rx_bytes'] / (1024 * 1024):.2f}MB / {net_io['tx_bytes'] / (1024 * 1024):.2f}MB",
                    'block_io': f"{blk_read / (1024 * 1024):.2f}MB / {blk_write / (1024 * 1024):.2f}MB",
                    'pid': container_details.get('State', {}).get('Pid', 'N/A')
                })
            except Exception as e:
                import traceback
                traceback.logging.info_exc()
                logger.error(f"Error processing container {container.id}: {e}")
                logger.error(f"Container state: {container.attrs.get('State', 'Unknown')}")
                logger.error(f"Container status: {container.status}")
        return container_info
    except docker.errors.DockerException as e:
        logger.warning(f"Docker is not available: {e}")
        return []
    except Exception as e:
        logger.error(f"Error getting Docker container info: {e}")
        return []

# Metrics Update
def update_metrics():
    global metrics, last_update_time, last_metrics_update, metric_collection_times
    last_disk_io = get_disk_io()
    last_net_usage = get_network_usage()
    last_time = time.time()

    static_network_info = get_static_network_info()
    static_disk_info = get_static_disk_info()
    static_cpu_info = get_static_cpu_info()

    while True:
        start_time = time.time()
        current_time = start_time
        elapsed = current_time - last_time

        new_metrics = {}
        new_collection_times = {}

        # Update CPU metrics (every cycle)
        cpu_start = time.time()
        new_metrics['cpu'] = {**static_cpu_info, **get_cpu_info()}
        new_collection_times['cpu'] = time.time() - cpu_start

        # Update other metrics
        for metric, func, interval in [
            ('memory', get_memory_info, 5),
            ('disk', lambda: {mountpoint: {**static_disk_info.get(mountpoint, {}), **get_disk_info(mountpoint)} for mountpoint in static_disk_info}, 10),
            ('gpu', get_gpu_info, 5),
            ('disk_io', get_disk_io, 2),
            ('network', get_network_usage, 2),
            ('top_processes', get_top_processes, 5),
            ('docker_containers', get_docker_containers if is_docker_available() else lambda: None, 10)
        ]:
            if metric not in last_metrics_update or (current_time - last_metrics_update.get(metric, 0)) >= interval:
                metric_start = time.time()
                new_metrics[metric] = func()
                new_collection_times[metric] = time.time() - metric_start
                last_metrics_update[metric] = current_time

        # Process disk_io and network metrics
        if 'disk_io' in new_metrics and 'network' in new_metrics:
            current_disk_io = new_metrics['disk_io']
            current_net_usage = new_metrics['network']
            disk_io_speed, net_speed = calculate_speeds(last_disk_io, current_disk_io, last_net_usage, current_net_usage, elapsed)
            new_metrics['disk_io'] = {**disk_io_speed, 'filesystem': current_disk_io.get('filesystem', 'Unknown')}
            new_metrics['network'] = {**net_speed, 'static_info': static_network_info}
            last_disk_io = current_disk_io
            last_net_usage = current_net_usage

        with metrics_lock:
            metrics.update(new_metrics)
            metric_collection_times.update(new_collection_times)
            last_update_time = datetime.datetime.now()

        last_time = current_time

        end_time = time.time()
        sleep_time = max(0, config['refresh_rate'] - (end_time - start_time))

        time.sleep(sleep_time)

def calculate_speeds(last_disk_io, current_disk_io, last_net_usage, current_net_usage, elapsed):
    if elapsed > 0:
        disk_io_speed = {
            'read_speed': max(0, (current_disk_io['read_bytes'] - last_disk_io['read_bytes'])) / elapsed / 1024 / 1024,
            'write_speed': max(0, (current_disk_io['write_bytes'] - last_disk_io['write_bytes'])) / elapsed / 1024 / 1024,
        }
        net_speed = {
            'upload_speed': max(0, (current_net_usage['bytes_sent'] - last_net_usage['bytes_sent'])) / elapsed / 1024 / 1024,
            'download_speed': max(0, (current_net_usage['bytes_recv'] - last_net_usage['bytes_recv'])) / elapsed / 1024 / 1024,
        }
    else:
        disk_io_speed = {'read_speed': 0, 'write_speed': 0}
        net_speed = {'upload_speed': 0, 'download_speed': 0}
    
    return disk_io_speed, net_speed

# Add this function to get top processes
def get_top_processes(limit=10):
    processes = []
    try:
        for proc in psutil.process_iter(['pid', 'name', 'status', 'username']):
            try:
                pinfo = proc.as_dict(attrs=['pid', 'name', 'status', 'username'])
                
                # Get CPU usage (this is a lightweight call)
                pinfo['cpu_percent'] = proc.cpu_percent(interval=None)
                
                # Get memory usage
                with proc.oneshot():
                    mem_info = proc.memory_info()
                    pinfo['memory_percent'] = proc.memory_percent()
                    pinfo['memory_mb'] = mem_info.rss / (1024 * 1024)
                    
                    # Get CPU time
                    cpu_times = proc.cpu_times()
                    pinfo['cpu_time'] = cpu_times.user + cpu_times.system
                
                processes.append(pinfo)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
    except Exception as e:
        logger.error(f"Error in get_top_processes: {e}")
        return []

    # Sort processes by CPU usage
    processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
    
    # Take the top 'limit' processes
    top_processes = processes[:limit]
    
    # Normalize CPU percentages for the top processes
    total_cpu_percent = sum(p['cpu_percent'] for p in top_processes)
    if total_cpu_percent > 0:
        for p in top_processes:
            p['cpu_percent'] = (p['cpu_percent'] / total_cpu_percent) * 100

    return top_processes

# Flask Routes
@app.route('/')
def index():
    disks = psutil.disk_partitions()
    hostname = socket.gethostname()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    except:
        local_ip = "Unable to retrieve"
    
    return render_template('index.html', disks=[p.mountpoint for p in disks], hostname=hostname, ip_address=local_ip)

@app.route('/metrics')
def get_metrics():
    selected_disk = request.args.get('disk', '/')
    with metrics_lock:
        response = {
            'cpu': metrics.get('cpu', {}),
            'memory': metrics.get('memory', {}),
            'disk': metrics.get('disk', {}).get(selected_disk, get_disk_info(selected_disk)),
            'gpu': metrics.get('gpu', {}),
            'disk_io': metrics.get('disk_io', {}),
            'network': metrics.get('network', {}),
            'top_processes': metrics.get('top_processes', []),
            'docker_containers': metrics.get('docker_containers'),
        }
        
        # Always include last update timestamp and metric collection times
        if last_update_time:
            response['last_update'] = last_update_time.isoformat()
        response['metric_collection_times'] = {k: f"{v:.6f}" for k, v in metric_collection_times.items()}

    return jsonify(response)

# Command-line argument parsing
def parse_arguments():
    parser = argparse.ArgumentParser(description='ez_monitor - System Metrics Dashboard')
    parser.add_argument('-p', '--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('-r', '--refresh-rate', type=float, default=2, help='Refresh rate in seconds')
    parser.add_argument('-m', '--max-data-points', type=int, default=1800, help='Maximum number of data points to keep')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    return parser.parse_args()

def main():
    args = parse_arguments()
    
    # Update logging level based on debug flag
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    logging.info(f"Starting ez_monitor with the following configuration:")
    logging.info(f"Port: {args.port}")
    logging.info(f"Refresh rate: {args.refresh_rate} seconds")
    logging.info(f"Max data points: {args.max_data_points}")
    logging.info(f"Debug mode: {'On' if args.debug else 'Off'}")
    
    # Update global configuration
    config['refresh_rate'] = args.refresh_rate
    config['max_data_points'] = args.max_data_points
    
    # Start the background metrics update thread
    metrics_thread = Thread(target=update_metrics, daemon=True)
    metrics_thread.start()
    
    # Run the Flask app with auto-reload when in debug mode
    app.run(debug=args.debug, use_reloader=args.debug, threaded=True, host='0.0.0.0', port=args.port)

if __name__ == '__main__':
    main()
