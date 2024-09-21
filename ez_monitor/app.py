from flask import Flask, render_template, jsonify
import psutil
import time

app = Flask(__name__)

def get_cpu_usage():
    return psutil.cpu_percent()

def get_cpu_count():
    return psutil.cpu_count()

def get_memory_usage():
    return psutil.virtual_memory().percent

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/metrics')
def metrics():
    return jsonify({
        'cpu': get_cpu_usage(),
        'cpu_count': get_cpu_count(),
        'memory': get_memory_usage(),
        'timestamp': int(time.time() * 1000)
    })

if __name__ == '__main__':
    app.run(debug=True)
