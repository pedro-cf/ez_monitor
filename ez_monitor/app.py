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

app = Flask(__name__)

# Global variables to store metrics
metrics = {
    'cpu': {},
    'memory': {},
    'disk': {},
    'gpu': {},
    'disk_io': {},
    'network': {}
}
metrics_lock = Lock()

# Global configuration
config = {
    'refresh_rate': 2,
    'max_data_points': 1800
}

# Cache CPU info that doesn't change
@lru_cache(maxsize=1)
def get_static_cpu_info():
    cpu_info = cpuinfo.get_cpu_info()
    return {
        'count': psutil.cpu_count(),
        'name': cpu_info['brand_raw'],
    }

def update_cpu_info():
    static_info = get_static_cpu_info()
    dynamic_info = {
        'usage': psutil.cpu_percent(interval=0.1),
        'frequency': f"{psutil.cpu_freq().current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': psutil.cpu_count(logical=True),
        'running': len([p for p in psutil.process_iter(['status']) if p.info['status'] == psutil.STATUS_RUNNING]),
    }
    
    if hasattr(os, 'getloadavg'):
        load_avg = os.getloadavg()
        dynamic_info['load_average'] = f"{load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}"
    else:
        dynamic_info['load_average'] = "N/A (Windows)"
    
    return {**static_info, **dynamic_info}

def update_memory_info():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    used_gb = mem.used / (1024 ** 3)
    total_gb = mem.total / (1024 ** 3)
    
    used_str = f"{used_gb * 1024:.2f} MB" if used_gb < 1 else f"{used_gb:.2f} GB"
    
    return {
        'total': f"{total_gb:.2f} GB",
        'used': used_str,
        'percent': mem.percent,
        'swap_total': f"{swap.total / (1024 ** 3):.2f} GB",
    }

def update_disk_info(path='/'):
    try:
        usage = shutil.disk_usage(path)
        total_gb = usage.total / (1024 ** 3)
        used_gb = usage.used / (1024 ** 3)
        free_gb = usage.free / (1024 ** 3)
        
        percent = (usage.used / usage.total) * 100

        partitions = psutil.disk_partitions()
        partition_info = next((p for p in partitions if p.mountpoint == path), None)
        
        is_ssd = "Unknown"
        if sys.platform.startswith('linux'):
            try:
                with open(f'/sys/block/{os.path.basename(partition_info.device)}/queue/rotational') as f:
                    is_ssd = "SSD" if f.read().strip() == '0' else "HDD"
            except:
                pass
        
        return {
            'total': f"{total_gb:.2f} GB",
            'used': f"{used_gb:.2f} GB",
            'free': f"{free_gb:.2f} GB",
            'percent': round(percent, 1),
            'device': partition_info.device if partition_info else 'Unknown',
            'mountpoint': partition_info.mountpoint if partition_info else 'Unknown',
            'type': is_ssd,
            'remote': 'Yes' if partition_info and 'remote' in partition_info.opts else 'No'
        }
    except Exception as e:
        print(f"Error getting disk info: {e}")
        return {
            'total': "N/A", 'used': "N/A", 'free': "N/A", 'percent': 0,
            'device': "N/A", 'mountpoint': "N/A", 'type': "N/A", 'remote': "N/A"
        }

def update_gpu_info():
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
        print(f"Error getting GPU info: {e}")
        return {'error': str(e)}

def update_disk_io():
    io_counters = psutil.disk_io_counters()
    return {
        'read_bytes': io_counters.read_bytes,
        'write_bytes': io_counters.write_bytes,
        'read_count': io_counters.read_count,
        'write_count': io_counters.write_count,
    }

def update_network_usage():
    net_counters = psutil.net_io_counters()
    return {
        'bytes_sent': net_counters.bytes_sent,
        'bytes_recv': net_counters.bytes_recv,
        'packets_sent': net_counters.packets_sent,
        'packets_recv': net_counters.packets_recv,
    }

def parse_arguments():
    parser = argparse.ArgumentParser(description='ez_monitor - System Metrics Dashboard')
    parser.add_argument('-p', '--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('-r', '--refresh-rate', type=float, default=2.0, help='Refresh rate in seconds')
    parser.add_argument('-m', '--max-data-points', type=int, default=1800, help='Maximum number of data points to keep')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    return parser.parse_args()

def update_metrics():
    global metrics
    last_disk_io = update_disk_io()
    last_net_usage = update_network_usage()
    last_time = time.time()

    while True:
        current_time = time.time()
        elapsed = current_time - last_time

        current_disk_io = update_disk_io()
        current_net_usage = update_network_usage()

        # Avoid division by zero
        if elapsed > 0:
            disk_io_speed = {
                'read_speed': (current_disk_io['read_bytes'] - last_disk_io['read_bytes']) / elapsed / 1024 / 1024,
                'write_speed': (current_disk_io['write_bytes'] - last_disk_io['write_bytes']) / elapsed / 1024 / 1024,
            }

            net_speed = {
                'upload_speed': (current_net_usage['bytes_sent'] - last_net_usage['bytes_sent']) / elapsed / 1024 / 1024,
                'download_speed': (current_net_usage['bytes_recv'] - last_net_usage['bytes_recv']) / elapsed / 1024 / 1024,
            }
        else:
            disk_io_speed = {'read_speed': 0, 'write_speed': 0}
            net_speed = {'upload_speed': 0, 'download_speed': 0}

        new_metrics = {
            'cpu': update_cpu_info(),
            'memory': update_memory_info(),
            'disk': {p.mountpoint: update_disk_info(p.mountpoint) for p in psutil.disk_partitions()},
            'gpu': update_gpu_info(),
            'disk_io': disk_io_speed,
            'network': net_speed,
        }
        with metrics_lock:
            metrics.update(new_metrics)

        last_disk_io = current_disk_io
        last_net_usage = current_net_usage
        last_time = current_time

        time.sleep(config['refresh_rate'])  # Use the configured refresh rate

@app.route('/')
def index():
    disks = psutil.disk_partitions()
    return render_template('index.html', disks=[p.mountpoint for p in disks])

@app.route('/metrics')
def get_metrics():
    selected_disk = request.args.get('disk', '/')
    with metrics_lock:
        response = {
            'cpu': metrics.get('cpu', {}),
            'memory': metrics.get('memory', {}),
            'disk': metrics.get('disk', {}).get(selected_disk, update_disk_info(selected_disk)),
            'gpu': metrics.get('gpu', {}),
            'disk_io': metrics.get('disk_io', {}),
            'network': metrics.get('network', {})
        }
    return jsonify(response)

if __name__ == '__main__':
    args = parse_arguments()
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
    
    # Use 0.0.0.0 to make the app accessible from other devices on the network
    app.run(debug=args.debug, threaded=True, host='0.0.0.0', port=args.port)
