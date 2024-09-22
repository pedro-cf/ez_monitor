let cpuMax = 0;
let memoryMax = 0;
let diskMax = 0;
let gpuMax = 0;
let diskIOMax = 0;
let networkMax = 0;
const diskSelector = document.getElementById('diskSelector');

let cpuChart, memoryChart, diskChart, gpuChart, diskIOChart, networkChart;
const maxDataPoints = 1800; // Show last 60 minutes of data (60 * 60 / 2 = 1800)
const updateInterval = 2000; // Update every 2000 milliseconds (2 seconds)

function createChart(ctx, label, isPercentage = true, fixedMax = null) {
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
                        maxTicksLimit: 6,
                        maxRotation: 0,
                        font: {
                            size: 10
                        },
                        callback: function(value, index, values) {
                            const date = new Date(this.getLabelForValue(value));
                            return date.toTimeString().substr(0, 5);  // Returns time in HH:MM format
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            if (isPercentage) {
                                return value + '%';
                            } else if (label === 'Network Usage (KB/s)') {
                                return value.toFixed(0) + ' KB/s';
                            } else {
                                return value.toFixed(2);
                            }
                        }
                    },
                    max: fixedMax // Set a fixed maximum if provided
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
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (isPercentage) {
                                label += context.parsed.y.toFixed(1) + '%';
                            } else {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
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
    cpuChart = createChart(document.getElementById('cpuChart').getContext('2d'), 'CPU Usage', true, 100);
    memoryChart = createChart(document.getElementById('memoryChart').getContext('2d'), 'Memory Usage (GB)', false);
    diskChart = createChart(document.getElementById('diskChart').getContext('2d'), 'Disk Space (GB)', false);
    gpuChart = createChart(document.getElementById('gpuChart').getContext('2d'), 'GPU Usage', true, 100);
    diskIOChart = createChart(document.getElementById('diskIOChart').getContext('2d'), 'Disk I/O (MB/s)', false);
    networkChart = createChart(document.getElementById('networkChart').getContext('2d'), 'Network Usage (KB/s)', false);
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
        Cores: ${cpu.count}<br>
        &nbsp;
    `;
    dynamicInfoElement.innerHTML = `
        <div class="value-box">Tasks: ${cpu.tasks}</div>
        <div class="value-box">Threads: ${cpu.threads}</div>
        <div class="value-box">Running: ${cpu.running}</div>
        <div class="value-box">Load: ${cpu.load_average}</div>
    `;
    
    updateProgressColor(progress, cpu.usage);

    if (cpu.usage > cpuMax) {
        cpuMax = cpu.usage;
        maxLine.style.left = `calc(${cpuMax}% - 2px)`;
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
        <div class="value-box">Used: ${memory.used} GB</div>
        <div class="value-box">Total: ${memory.total} GB</div>
        <div class="value-box">Swap: ${memory.swap_used} GB</div>
        <div class="value-box">Swap Total: ${memory.swap_total} GB</div>
    `;
    
    infoElement.innerHTML = `
        Total RAM: ${memory.total}<br>
        Swap Total: ${memory.swap_total}<br>
        &nbsp;
    `;
    
    updateProgressColor(progress, memory.percent);

    if (memory.percent > memoryMax) {
        memoryMax = memory.percent;
        maxLine.style.left = `calc(${memoryMax}% - 2px)`;
        maxLine.style.display = 'block';
    }
    
    const usedGB = parseFloat(memory.used);
    const totalGB = parseFloat(memory.total);
    
    if (memoryChart.options.scales.y.max === null) {
        memoryChart.options.scales.y.max = totalGB;
    }
    
    updateChart(memoryChart, usedGB);
}

function updateDiskMetric(disk) {
    const progress = document.getElementById('diskProgress');
    const percentElement = document.getElementById('diskPercent');
    const dynamicInfoElement = document.getElementById('diskDynamicInfo');
    const staticInfoElement = document.getElementById('diskStaticInfo');
    const maxLine = document.getElementById('diskMaxLine');
    
    progress.style.width = `${disk.percent}%`;
    percentElement.textContent = `${disk.percent.toFixed(1)}%`;
    
    dynamicInfoElement.innerHTML = `
        <div class="value-box">Used: ${disk.used}</div>
        <div class="value-box">Free: ${disk.free}</div>
        <div class="value-box">Total: ${disk.total}</div>
    `;
    
    staticInfoElement.innerHTML = `
        Device: ${disk.device}<br>
        Remote: ${disk.remote}<br>
        &nbsp;
    `;
    
    updateProgressColor(progress, disk.percent);

    if (disk.percent > diskMax) {
        diskMax = disk.percent;
        maxLine.style.left = `calc(${diskMax}% - 2px)`;
        maxLine.style.display = 'block';
    }
    
    const usedGB = parseFloat(disk.used);
    const totalGB = parseFloat(disk.total);
    
    if (diskChart.options.scales.y.max === null) {
        diskChart.options.scales.y.max = totalGB;
    }
    
    updateChart(diskChart, usedGB);
}

function updateGPUMetric(gpu) {
    const progress = document.getElementById('gpuProgress');
    const percentElement = document.getElementById('gpuPercent');
    const dynamicInfoElement = document.getElementById('gpuDynamicInfo');
    const infoElement = document.getElementById('gpuInfo');
    const maxLine = document.getElementById('gpuMaxLine');
    
    if (gpu && !gpu.error) {
        progress.style.width = `${gpu.percent}%`;
        percentElement.textContent = `${gpu.percent.toFixed(1)}%`;
        dynamicInfoElement.innerHTML = `
            <div class="value-box">Mem Used: ${gpu.memory_used}</div>
            <div class="value-box">Mem Total: ${gpu.memory_total}</div>
            <div class="value-box">Temp: ${gpu.temperature}°C</div>
        `;
        infoElement.innerHTML = `
            Name: ${gpu.name}<br>
            VRAM: ${gpu.memory_total}<br>
            Driver: ${gpu.driver}
        `;
        
        updateProgressColor(progress, gpu.percent);

        if (gpu.percent > gpuMax) {
            gpuMax = gpu.percent;
            maxLine.style.left = `calc(${gpuMax}% - 2px)`;
            maxLine.style.display = 'block';
        }
        
        updateChart(gpuChart, gpu.percent);
    } else {
        console.error('Invalid or missing GPU data:', gpu);
        infoElement.innerHTML = gpu.error || 'No GPU data available';
    }
}

function updateDiskIOMetric(diskIO) {
    const progress = document.getElementById('diskIOProgress');
    const percentElement = document.getElementById('diskIOPercent');
    const dynamicInfoElement = document.getElementById('diskIODynamicInfo');
    const infoElement = document.getElementById('diskIOInfo');
    const maxLine = document.getElementById('diskIOMaxLine');
    
    const totalSpeed = diskIO.read_speed + diskIO.write_speed;
    const percent = Math.min(totalSpeed / diskIOMax * 100, 100);
    
    progress.style.width = `${percent}%`;
    percentElement.textContent = `${percent.toFixed(1)}%`;
    dynamicInfoElement.innerHTML = `
        <div class="value-box">Read: ${diskIO.read_speed.toFixed(2)} MB/s</div>
        <div class="value-box">Write: ${diskIO.write_speed.toFixed(2)} MB/s</div>
        <div class="value-box">Total: ${totalSpeed.toFixed(2)} MB/s</div>
        <div class="value-box">Max: ${diskIOMax.toFixed(2)} MB/s</div>
    `;
    infoElement.innerHTML = `
        Filesystem: ${diskIO.filesystem || 'Unknown'}<br>
        &nbsp;<br>
        &nbsp;
    `;
    
    updateProgressColor(progress, percent);

    if (totalSpeed > diskIOMax) {
        diskIOMax = totalSpeed;
        maxLine.style.left = 'calc(100% - 2px)';
        maxLine.style.display = 'block';
    }
    
    updateChart(diskIOChart, totalSpeed);
}

function updateNetworkMetric(network) {
    const progress = document.getElementById('networkProgress');
    const percentElement = document.getElementById('networkPercent');
    const dynamicInfoElement = document.getElementById('networkDynamicInfo');
    const infoElement = document.getElementById('networkInfo');
    const maxLine = document.getElementById('networkMaxLine');
    
    const totalSpeed = network.upload_speed + network.download_speed;
    const percent = Math.min(totalSpeed / networkMax * 100, 100);
    
    progress.style.width = `${percent}%`;
    percentElement.textContent = `${percent.toFixed(1)}%`;
    dynamicInfoElement.innerHTML = `
        <div class="value-box">Up: ${(network.upload_speed * 1024).toFixed(2)} KB/s</div>
        <div class="value-box">Down: ${(network.download_speed * 1024).toFixed(2)} KB/s</div>
        <div class="value-box">Total: ${(totalSpeed * 1024).toFixed(2)} KB/s</div>
        <div class="value-box">Max: ${(networkMax * 1024).toFixed(2)} KB/s</div>
    `;
    
    // Add simplified static network information
    let staticInfoHTML = '';
    if (network.static_info.general) {
        const general = network.static_info.general;
        staticInfoHTML += `Hostname: ${general.hostname}<br>`;
        staticInfoHTML += `Local IP: ${general.local_ip}<br>`;
        staticInfoHTML += `Public IP: ${general.public_ip}<br>`;
    }
    
    const relevantInterfaces = Object.entries(network.static_info).filter(([name, info]) => 
        name !== 'general' && !name.includes('Loopback') && !name.includes('VMware') && info.ipv4 !== 'Unknown' && info.ipv4 !== '127.0.0.1'
    );
    
    for (const [interface, info] of relevantInterfaces.slice(0, 2)) {  // Show only up to 2 interfaces
        staticInfoHTML += `${interface}: ${info.ipv4}<br>`;
    }
    infoElement.innerHTML = staticInfoHTML;
    
    updateProgressColor(progress, percent);

    if (totalSpeed > networkMax) {
        networkMax = totalSpeed;
        maxLine.style.left = 'calc(100% - 2px)';
        maxLine.style.display = 'block';
    }
    
    updateChart(networkChart, totalSpeed * 1024);  // Convert to KB/s for the chart
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
            updateDiskIOMetric(data.disk_io);
            updateNetworkMetric(data.network);
            initializeScrollBehavior(); // Add this line
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

// Move all the settings-related code inside a function
function initializeSettings() {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeButton = settingsModal.querySelector('.close');
    const columnCountSlider = document.getElementById('columnCount');
    const columnCountValue = document.getElementById('columnCountValue');
    const showHeaderCheckbox = document.getElementById('showHeader');
    const showGaugesCheckbox = document.getElementById('showGauges');
    const showDynamicInfoCheckbox = document.getElementById('showDynamicInfo');
    const showStaticInfoCheckbox = document.getElementById('showStaticInfo');
    const showChartsCheckbox = document.getElementById('showCharts');
    const containerToggles = document.getElementById('containerToggles');

    // Open the modal
    settingsButton.onclick = function() {
        settingsModal.style.display = 'block';
    }

    // Close the modal
    closeButton.onclick = function() {
        settingsModal.style.display = 'none';
    }

    // Close the modal if clicked outside
    window.onclick = function(event) {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
    }

    // Update column count
    columnCountSlider.oninput = function() {
        const columnCount = this.value;
        columnCountValue.textContent = columnCount;
        document.querySelector('.dashboard').style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
    }

    // Toggle header visibility
    showHeaderCheckbox.onchange = function() {
        document.querySelector('.dashboard-header').style.display = this.checked ? 'block' : 'none';
    }

    // Toggle gauges visibility
    showGaugesCheckbox.onchange = function() {
        document.querySelectorAll('.progress-bar').forEach(el => {
            el.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Toggle dynamic info boxes visibility
    showDynamicInfoCheckbox.onchange = function() {
        document.querySelectorAll('.disk-info-row').forEach(el => {
            el.style.display = this.checked ? 'flex' : 'none';
        });
    }

    // Toggle static info boxes visibility
    showStaticInfoCheckbox.onchange = function() {
        document.querySelectorAll('.info').forEach(el => {
            el.style.display = this.checked ? 'flex' : 'none';
        });
    }

    // Toggle charts visibility
    showChartsCheckbox.onchange = function() {
        document.querySelectorAll('.chart-container').forEach(el => {
            el.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Create container toggles
    function createContainerToggles() {
        const containers = document.querySelectorAll('.metric-container');
        containers.forEach((container, index) => {
            const label = container.querySelector('.label').textContent.trim().split(' ')[0];
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `toggle-${label.toLowerCase()}`;
            checkbox.checked = true;
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = checkbox.id;
            labelElement.appendChild(checkbox);
            labelElement.appendChild(document.createTextNode(` Show ${label}`));
            
            containerToggles.appendChild(labelElement);
            
            checkbox.onchange = function() {
                container.style.display = this.checked ? 'flex' : 'none';
            }
        });
    }

    createContainerToggles();
    
    // Set initial column count
    columnCountSlider.value = '3';
    columnCountSlider.dispatchEvent(new Event('input'));
    
    // Set initial visibility states
    showHeaderCheckbox.checked = true;
    showHeaderCheckbox.dispatchEvent(new Event('change'));
    showGaugesCheckbox.checked = true;
    showGaugesCheckbox.dispatchEvent(new Event('change'));
    showDynamicInfoCheckbox.checked = true;
    showDynamicInfoCheckbox.dispatchEvent(new Event('change'));
    showStaticInfoCheckbox.checked = true;
    showStaticInfoCheckbox.dispatchEvent(new Event('change'));
    showChartsCheckbox.checked = true;
    showChartsCheckbox.dispatchEvent(new Event('change'));
}

// Modify the existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    updateMetrics();
    initializeSettings();  // Add this line to initialize settings
});

// Remove any duplicate event listeners if they exist