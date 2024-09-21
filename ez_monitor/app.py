from flask import Flask, render_template, jsonify, request
import psutil
import time
import os
import cpuinfo
import shutil
import GPUtil
import sys

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
        total, used, free = shutil.disk_usage(path)
        
        total_gb = total / (1024 ** 3)
        used_gb = used / (1024 ** 3)
        free_gb = free / (1024 ** 3)
        
        percent = (used / total) * 100

        partitions = psutil.disk_partitions()
        partition_info = next((p for p in partitions if p.mountpoint == path), None)
        
        # Determine if it's SSD or HDD
        if sys.platform.startswith('linux'):
            try:
                with open('/sys/block/{}/queue/rotational'.format(os.path.basename(partition_info.device))) as f:
                    is_ssd = f.read().strip() == '0'
            except:
                is_ssd = False
        else:
            # For non-Linux systems, we can't easily determine SSD/HDD
            is_ssd = "Unknown"
        
        disk_type = "SSD" if is_ssd == True else "HDD" if is_ssd == False else "Unknown"
        
        return {
            'total': f"{total_gb:.2f} GB",
            'used': f"{used_gb:.2f} GB",
            'free': f"{free_gb:.2f} GB",
            'percent': round(percent, 1),
            'device': partition_info.device if partition_info else 'Unknown',
            'mountpoint': partition_info.mountpoint if partition_info else 'Unknown',
            'type': disk_type,
            'remote': 'Yes' if partition_info and 'remote' in partition_info.opts else 'No'
        }
    except Exception as e:
        print(f"Error getting disk info: {e}")
        return {
            'total': "N/A",
            'used': "N/A",
            'free': "N/A",
            'percent': 0,
            'device': "N/A",
            'mountpoint': "N/A",
            'type': "N/A",
            'remote': "N/A"
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
                'temperature': gpu.temperature,
                'driver': gpu.driver,
                'cuda_version': gpu.cuda_version if hasattr(gpu, 'cuda_version') else 'N/A'
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
