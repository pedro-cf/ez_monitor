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

# Set up logging at the module level
logging.basicConfig(level=logging.WARNING, format='%(levelname)s:%(name)s:%(message)s')
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
    dynamic_info = {
        'usage': psutil.cpu_percent(interval=0.1),
        'frequency': f"{psutil.cpu_freq().current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': psutil.cpu_count(logical=True),
        'running': len([p for p in psutil.process_iter(['status']) if p.info['status'] == psutil.STATUS_RUNNING]),
        'load_average': get_load_average()
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
    
    return {
        'total': f"{total_gb:.2f}",
        'used': f"{used_gb:.2f}",
        'percent': mem.percent,
        'swap_total': f"{swap.total / (1024 ** 3):.2f}",
        'swap_used': f"{swap.used / (1024 ** 3):.2f}",
        'swap_percent': swap.percent
    }

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
            logger.debug(f"Linux disk I/O (per disk): {io_counters}")
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
        local_ip = socket.gethostbyname(hostname)
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

# Metrics Update
def update_metrics():
    global metrics
    last_disk_io = get_disk_io()
    last_net_usage = get_network_usage()
    last_time = time.time()

    # Calculate static information only once
    static_network_info = get_static_network_info()
    static_disk_info = get_static_disk_info()
    static_cpu_info = get_static_cpu_info()

    while True:
        current_time = time.time()
        elapsed = current_time - last_time

        current_disk_io = get_disk_io()
        current_net_usage = get_network_usage()

        disk_io_speed, net_speed = calculate_speeds(last_disk_io, current_disk_io, last_net_usage, current_net_usage, elapsed)
        
        # Add the filesystem information to disk_io_speed
        disk_io_speed['filesystem'] = current_disk_io.get('filesystem', 'Unknown')

        logger.debug(f"Current disk I/O: {current_disk_io}")
        logger.debug(f"Calculated disk I/O speed: {disk_io_speed}")

        new_metrics = {
            'cpu': {**static_cpu_info, **get_cpu_info()},
            'memory': get_memory_info(),
            'disk': {
                mountpoint: {**static_disk_info.get(mountpoint, {}), **get_disk_info(mountpoint)}
                for mountpoint in static_disk_info
            },
            'gpu': get_gpu_info(),
            'disk_io': disk_io_speed,
            'network': {**net_speed, 'static_info': static_network_info},
        }
        with metrics_lock:
            metrics.update(new_metrics)

        last_disk_io = current_disk_io
        last_net_usage = current_net_usage
        last_time = current_time

        time.sleep(config['refresh_rate'])

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
    
    logger.debug(f"Calculated disk I/O speeds: {disk_io_speed}")
    logger.debug(f"Calculated network speeds: {net_speed}")
    
    return disk_io_speed, net_speed

# Flask Routes
@app.route('/')
def index():
    disks = psutil.disk_partitions()
    hostname = socket.gethostname()
    try:
        ip_address = socket.gethostbyname(hostname)
    except:
        ip_address = "Unable to retrieve"
    
    return render_template('index.html', disks=[p.mountpoint for p in disks], hostname=hostname, ip_address=ip_address)

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
            'network': metrics.get('network', {})
        }
    logger.debug(f"Metrics response: {response}")
    return jsonify(response)

# Command-line argument parsing
def parse_arguments():
    parser = argparse.ArgumentParser(description='ez_monitor - System Metrics Dashboard')
    parser.add_argument('-p', '--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('-r', '--refresh-rate', type=float, default=0.5, help='Refresh rate in seconds')
    parser.add_argument('-m', '--max-data-points', type=int, default=1800, help='Maximum number of data points to keep')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    return parser.parse_args()

def main():
    args = parse_arguments()
    
    # Update logging level based on debug flag
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    print(f"Starting ez_monitor with the following configuration:")
    print(f"Port: {args.port}")
    print(f"Refresh rate: {args.refresh_rate} seconds")
    print(f"Max data points: {args.max_data_points}")
    print(f"Debug mode: {'On' if args.debug else 'Off'}")
    
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
