from flask import Flask, render_template, jsonify, request
import psutil
import time
import os
import cpuinfo

app = Flask(__name__)

def get_cpu_info():
    cpu_freq = psutil.cpu_freq()
    load_avg = os.getloadavg()
    cpu_info = cpuinfo.get_cpu_info()
    return {
        'usage': psutil.cpu_percent(),
        'count': psutil.cpu_count(),
        'name': cpu_info['brand_raw'],
        'frequency': f"{cpu_freq.current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': sum(p.num_threads() for p in psutil.process_iter()),
        'running': len([p for p in psutil.process_iter() if p.status() == psutil.STATUS_RUNNING]),
        'load_average': f"{load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}"
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
    disk = psutil.disk_usage(path)
    io_counters = psutil.disk_io_counters(perdisk=True)
    disk_name = os.path.basename(path)
    io_counter = io_counters.get(disk_name, psutil.disk_io_counters())
    
    return {
        'total': f"{disk.total / (1024 ** 3):.2f} GB",
        'used': f"{disk.used / (1024 ** 3):.2f} GB",
        'free': f"{disk.free / (1024 ** 3):.2f} GB",
        'percent': disk.percent,
        'read': f"{io_counter.read_bytes / (1024 ** 3):.2f} GB",
        'write': f"{io_counter.write_bytes / (1024 ** 3):.2f} GB"
    }

def get_available_disks():
    partitions = psutil.disk_partitions(all=False)
    return [p.mountpoint for p in partitions]

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
        'timestamp': int(time.time() * 1000)
    })

if __name__ == '__main__':
    app.run(debug=True)
