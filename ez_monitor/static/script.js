let cpuMax = 0;
let memoryMax = 0;
let diskMax = 0;
let gpuMax = 0;
const diskSelector = document.getElementById('diskSelector');

let cpuChart, memoryChart, diskChart, gpuChart;
const maxDataPoints = 1800; // Show last 60 minutes of data (60 * 60 / 2 = 1800)
const updateInterval = 2000; // Update every 2000 milliseconds (2 seconds)

function createChart(ctx, label) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return null;
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.5)');
                    gradient.addColorStop(1, 'rgba(255, 0, 0, 0.5)');
                    return gradient;
                },
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxTicksLimit: 12, // Show 12 ticks on x-axis
                        maxRotation: 0,
                        font: {
                            size: 10
                        },
                        callback: function(value, index, values) {
                            return new Date(value).toLocaleTimeString('en-GB', { 
                                hour: '2-digit', 
                                minute: '2-digit'
                            });
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: 'rgba(255, 255, 255, 1)',
                    bodyColor: 'rgba(255, 255, 255, 1)',
                    displayColors: false
                }
            },
            animation: { duration: 0 }
        }
    });
}

function updateChart(chart, value) {
    const now = new Date();
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update('none');
}

function initCharts() {
    cpuChart = createChart(document.getElementById('cpuChart').getContext('2d'), 'CPU Usage');
    memoryChart = createChart(document.getElementById('memoryChart').getContext('2d'), 'Memory Usage');
    diskChart = createChart(document.getElementById('diskChart').getContext('2d'), 'Disk Usage');
    gpuChart = createChart(document.getElementById('gpuChart').getContext('2d'), 'GPU Usage');
}

function updateCPUMetric(cpu) {
    const progress = document.getElementById('cpuProgress');
    const percentElement = document.getElementById('cpuPercent');
    const infoElement = document.getElementById('cpuInfo');
    const dynamicInfoElement = document.getElementById('cpuDynamicInfo');
    const maxLine = document.getElementById('cpuMaxLine');
    
    progress.style.width = `${cpu.usage}%`;
    percentElement.textContent = `${cpu.usage.toFixed(1)}%`;
    infoElement.innerHTML = `
        Name: ${cpu.name}<br>
        Frequency: ${cpu.frequency}<br>
        Cores: ${cpu.count}
    `;
    dynamicInfoElement.innerHTML = `
        <div class="value-box">Tasks: ${cpu.tasks}</div>
        <div class="value-box">Threads: ${cpu.threads}</div>
        <div class="value-box">Running: ${cpu.running}</div>
        <div class="value-box">Load Avg: ${cpu.load_average}</div>
    `;
    
    updateProgressColor(progress, cpu.usage);

    if (cpu.usage > cpuMax) {
        cpuMax = cpu.usage;
        maxLine.style.left = `${cpuMax}%`;
        maxLine.style.display = 'block';
    }
    
    updateChart(cpuChart, cpu.usage);
}

function updateMemoryMetric(memory) {
    const progress = document.getElementById('memoryProgress');
    const percentElement = document.getElementById('memoryPercent');
    const dynamicInfoElement = document.getElementById('memoryDynamicInfo');
    const infoElement = document.getElementById('memoryInfo');
    const maxLine = document.getElementById('memoryMaxLine');
    
    progress.style.width = `${memory.percent}%`;
    percentElement.textContent = `${memory.percent.toFixed(1)}%`;
    
    dynamicInfoElement.innerHTML = `
        <div class="value-box">${memory.used} / ${memory.total}</div>
    `;
    
    infoElement.innerHTML = `
        Total RAM: ${memory.total}<br>
        Swap Total: ${memory.swap_total}
    `;
    
    updateProgressColor(progress, memory.percent);

    if (memory.percent > memoryMax) {
        memoryMax = memory.percent;
        maxLine.style.left = `${memoryMax}%`;
        maxLine.style.display = 'block';
    }
    
    updateChart(memoryChart, memory.percent);
}

function updateDiskMetric(disk) {
    const progress = document.getElementById('diskProgress');
    const percentElement = document.getElementById('diskPercent');
    const usageElement = document.getElementById('diskUsage');
    const freeElement = document.getElementById('diskFree');
    const staticInfoElement = document.getElementById('diskStaticInfo');
    const maxLine = document.getElementById('diskMaxLine');
    
    progress.style.width = `${disk.percent}%`;
    percentElement.textContent = `${disk.percent.toFixed(1)}%`;
    usageElement.textContent = `${disk.used} / ${disk.total}`;
    freeElement.textContent = `Free: ${disk.free}`;
    
    staticInfoElement.innerHTML = `
        Remote: ${disk.remote}<br>
        Device: ${disk.device}
    `;
    
    updateProgressColor(progress, disk.percent);

    if (disk.percent > diskMax) {
        diskMax = disk.percent;
        maxLine.style.left = `${diskMax}%`;
        maxLine.style.display = 'block';
    }
    
    updateChart(diskChart, disk.percent);
}

function updateGPUMetric(gpu) {
    const progress = document.getElementById('gpuProgress');
    const percentElement = document.getElementById('gpuPercent');
    const dynamicInfoElement = document.getElementById('gpuDynamicInfo');
    const infoElement = document.getElementById('gpuInfo');
    const maxLine = document.getElementById('gpuMaxLine');
    
    if (gpu && typeof gpu.percent !== 'undefined') {
        progress.style.width = `${gpu.percent}%`;
        percentElement.textContent = `${gpu.percent.toFixed(1)}%`;
        dynamicInfoElement.innerHTML = `
            <div class="value-box">${gpu.memory_used} / ${gpu.memory_total}</div>
            <div class="value-box">${gpu.temperature}°C</div>
        `;
        infoElement.innerHTML = `
            Name: ${gpu.name}<br>
            VRAM: ${gpu.memory_total}<br>
            Driver Version: ${gpu.driver}<br>
            CUDA Version: ${gpu.cuda_version}
        `;
        
        updateProgressColor(progress, gpu.percent);

        if (gpu.percent > gpuMax) {
            gpuMax = gpu.percent;
            maxLine.style.left = `${gpuMax}%`;
            maxLine.style.display = 'block';
        }
        
        updateChart(gpuChart, gpu.percent);
    } else {
        console.error('Invalid or missing GPU data:', gpu);
        infoElement.innerHTML = 'No GPU data available';
    }
}

function updateMetrics() {
    const selectedDisk = diskSelector.value;
    fetch(`/metrics?disk=${encodeURIComponent(selectedDisk)}`)
        .then(response => response.json())
        .then(data => {
            console.log("Received data:", data);  // Keep this line
            updateCPUMetric(data.cpu);
            updateMemoryMetric(data.memory);
            updateDiskMetric(data.disk);
            updateGPUMetric(data.gpu);
        })
        .catch(error => {
            console.error('Error fetching metrics:', error);
        });
}

function updateProgressColor(progressElement, value) {
    const hue = (1 - value / 100) * 120;
    progressElement.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
}

// Update metrics when disk selection changes
diskSelector.addEventListener('change', updateMetrics);

// Update metrics every 2 seconds
setInterval(updateMetrics, updateInterval);

// Initialize charts and fetch initial data when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    updateMetrics();
});

// Remove the old event listener for DOMContentLoaded
// document.addEventListener('DOMContentLoaded', initCharts);