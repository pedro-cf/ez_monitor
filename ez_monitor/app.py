from flask import Flask, render_template, jsonify, request
import psutil
import time
import os
import cpuinfo
import shutil
import GPUtil

app = Flask(__name__)

def get_cpu_info():
    cpu_freq = psutil.cpu_freq()
    cpu_info = cpuinfo.get_cpu_info()
    
    if hasattr(os, 'getloadavg'):
        load_avg = os.getloadavg()
        load_avg_str = f"{load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}"
    else:
        load_avg_str = "N/A (Windows)"

    return {
        'usage': psutil.cpu_percent(),
        'count': psutil.cpu_count(),
        'name': cpu_info['brand_raw'],
        'frequency': f"{cpu_freq.current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': sum(p.num_threads() for p in psutil.process_iter()),
        'running': len([p for p in psutil.process_iter() if p.status() == psutil.STATUS_RUNNING]),
        'load_average': load_avg_str
    }

def get_memory_info():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    used_gb = mem.used / (1024 ** 3)
    total_gb = mem.total / (1024 ** 3)
    
    if used_gb < 1:
        used_str = f"{used_gb * 1024:.2f} MB"
    else:
        used_str = f"{used_gb:.2f} GB"
    
    return {
        'total': f"{total_gb:.2f} GB",
        'used': used_str,
        'percent': mem.percent,
        'swap_total': f"{swap.total / (1024 ** 3):.2f} GB",
    }

def get_disk_info(path='/'):
    try:
        # Use shutil for total, used, and free space
        total, used, free = shutil.disk_usage(path)
        
        # Convert bytes to GB
        total_gb = total / (1024 ** 3)
        used_gb = used / (1024 ** 3)
        free_gb = free / (1024 ** 3)
        
        # Calculate percentage
        percent = (used / total) * 100

        # Get I/O information
        io_counters = psutil.disk_io_counters(perdisk=True)
        disk_name = os.path.basename(path) if path != '/' else 'C:'
        io_counter = io_counters.get(disk_name, psutil.disk_io_counters())
        
        return {
            'total': f"{total_gb:.2f} GB",
            'used': f"{used_gb:.2f} GB",
            'free': f"{free_gb:.2f} GB",
            'percent': round(percent, 1),
            'read': f"{io_counter.read_bytes / (1024 ** 3):.2f} GB",
            'write': f"{io_counter.write_bytes / (1024 ** 3):.2f} GB"
        }
    except Exception as e:
        print(f"Error getting disk info: {e}")
        return {
            'total': "N/A",
            'used': "N/A",
            'free': "N/A",
            'percent': 0,
            'read': "N/A",
            'write': "N/A"
        }

def get_available_disks():
    partitions = psutil.disk_partitions(all=False)
    return [p.mountpoint for p in partitions]

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
                'temperature': gpu.temperature
            }
        else:
            return None
    except Exception as e:
        print(f"Error getting GPU info: {e}")
        return None

@app.route('/')
def index():
    disks = get_available_disks()
    return render_template('index.html', disks=disks)

@app.route('/metrics')
def metrics():
    selected_disk = request.args.get('disk', '/')
    return jsonify({
        'cpu': get_cpu_info(),
        'memory': get_memory_info(),
        'disk': get_disk_info(selected_disk),
        'gpu': get_gpu_info()
    })

if __name__ == '__main__':
    app.run(debug=True)
