from flask import Flask, render_template, jsonify
import psutil
import time
import os
import platform

app = Flask(__name__)

def get_cpu_info():
    cpu_freq = psutil.cpu_freq()
    load_avg = psutil.getloadavg()
    return {
        'usage': psutil.cpu_percent(),
        'count': psutil.cpu_count(),
        'name': platform.processor(),
        'frequency': f"{cpu_freq.current:.0f} MHz",
        'tasks': len(psutil.pids()),
        'threads': sum(p.num_threads() for p in psutil.process_iter()),
        'running': len([p for p in psutil.process_iter() if p.status() == psutil.STATUS_RUNNING]),
        'load_average': f"{load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}"
    }

def get_memory_info():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        'total': f"{mem.total / (1024 ** 3):.2f} GB",
        'available': f"{mem.available / (1024 ** 3):.2f} GB",
        'used': f"{mem.used / (1024 ** 3):.2f} GB",
        'percent': mem.percent,
        'swap_total': f"{swap.total / (1024 ** 3):.2f} GB",
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/metrics')
def metrics():
    return jsonify({
        'cpu': get_cpu_info(),
        'memory': get_memory_info(),
        'timestamp': int(time.time() * 1000)
    })

if __name__ == '__main__':
    app.run(debug=True)
