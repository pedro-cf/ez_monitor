from flask import Flask, render_template, jsonify, request
import psutil
import time
import os
import cpuinfo
import shutil
import GPUtil
import sys
from functools import lru_cache
from threading import Thread, Lock

app = Flask(__name__)

# Global variables to store metrics
metrics = {}
metrics_lock = Lock()

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
                'cuda_version': gpu.cuda_version if hasattr(gpu, 'cuda_version') else 'N/A'
            }
        else:
            return None
    except Exception as e:
        print(f"Error getting GPU info: {e}")
        return None

def update_metrics():
    global metrics
    while True:
        new_metrics = {
            'cpu': update_cpu_info(),
            'memory': update_memory_info(),
            'disk': {p.mountpoint: update_disk_info(p.mountpoint) for p in psutil.disk_partitions()},
            'gpu': update_gpu_info()
        }
        with metrics_lock:
            metrics = new_metrics
        time.sleep(0.5)  # Update every 500ms

@app.route('/')
def index():
    disks = psutil.disk_partitions()
    return render_template('index.html', disks=[p.mountpoint for p in disks])

@app.route('/metrics')
def get_metrics():
    selected_disk = request.args.get('disk', '/')
    with metrics_lock:
        response = {
            'cpu': metrics['cpu'],
            'memory': metrics['memory'],
            'disk': metrics['disk'].get(selected_disk, update_disk_info(selected_disk)),
            'gpu': metrics['gpu']
        }
    return jsonify(response)

if __name__ == '__main__':
    # Start the background metrics update thread
    metrics_thread = Thread(target=update_metrics, daemon=True)
    metrics_thread.start()
    
    app.run(debug=True, threaded=True)
