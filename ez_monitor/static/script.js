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

let cursorTimeout;
let settingsButtonTimeout;
const cursorHideDelay = 3000; // 3 seconds
const settingsButtonHideDelay = 3000; // 3 seconds

let isSettingsVisible = false;

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
                legend: { display: false }
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
        <div class="value-box">User: ${cpu.user.toFixed(1)}%</div>
        <div class="value-box">System: ${cpu.system.toFixed(1)}%</div>
        <div class="value-box">Idle: ${cpu.idle.toFixed(1)}%</div>
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
    
    let dynamicInfoHTML = `
        <div class="value-box">Used: ${memory.used} GB</div>
        <div class="value-box">Available: ${memory.available} GB</div>
    `;
    
    if (memory.cached) {
        dynamicInfoHTML += `<div class="value-box">Cached: ${memory.cached} GB</div>`;
    }
    if (memory.buffers) {
        dynamicInfoHTML += `<div class="value-box">Buffers: ${memory.buffers} GB</div>`;
    }
    
    dynamicInfoHTML += `
        <div class="value-box">Swap Used: ${memory.swap_used} GB</div>
        <div class="value-box">Swap Total: ${memory.swap_total} GB</div>
    `;
    
    dynamicInfoElement.innerHTML = dynamicInfoHTML;
    
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

// Update the updateTopProcesses function
function updateTopProcesses(processes) {
    const topProcessesElement = document.getElementById('topProcesses');
    let html = '<table><tr><th>PID</th><th>Name</th><th>Status</th><th>CPU %</th><th>MEM %</th><th>MEM (MB)</th><th>CPU Time</th><th>User</th></tr>';
    processes.forEach(proc => {
        const statusClass = getProcessStatusClass(proc.status);
        html += `<tr>
            <td>${proc.pid}</td>
            <td>${proc.name}</td>
            <td><span class="status-dot ${statusClass}"></span>${proc.status}</td>
            <td>${proc.cpu_percent.toFixed(1)}%</td>
            <td>${proc.memory_percent.toFixed(1)}%</td>
            <td>${proc.memory_mb.toFixed(1)}</td>
            <td>${proc.cpu_time.toFixed(2)}s</td>
            <td>${proc.username}</td>
        </tr>`;
    });
    html += '</table>';
    topProcessesElement.innerHTML = html;
}

function getProcessStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'running':
            return 'status-running';
        case 'sleeping':
            return 'status-sleeping';
        case 'disk-sleep':
            return 'status-disk-sleep';
        case 'stopped':
            return 'status-stopped';
        case 'tracing-stop':
            return 'status-tracing-stop';
        case 'zombie':
            return 'status-zombie';
        case 'dead':
            return 'status-dead';
        case 'wake-kill':
            return 'status-wake-kill';
        case 'waking':
            return 'status-waking';
        default:
            return 'status-unknown';
    }
}

// Update the updateDockerContainers function
function updateDockerContainers(containers) {
    const dockerContainersElement = document.getElementById('dockerContainers');
    let html = '<table><tr><th>ID</th><th>Name</th><th>Status</th><th>CPU %</th><th>MEM %</th><th>MEM Usage</th><th>NET I/O</th><th>BLOCK I/O</th></tr>';
    
    if (containers === null) {
        html += '<tr><td colspan="8">Docker is not available on this system.</td></tr>';
    } else if (containers.length === 0) {
        html += '<tr><td colspan="8">No Docker containers found.</td></tr>';
    } else {
        containers.forEach(container => {
            const statusClass = getStatusClass(container.status);
            html += `<tr>
                <td title="${container.id}">${container.short_id}</td>
                <td>${container.name}</td>
                <td><span class="status-dot ${statusClass}"></span>${container.status}</td>
                <td>${container.cpu_percent.toFixed(2)}%</td>
                <td>${container.mem_percent.toFixed(2)}%</td>
                <td>${container.mem_usage} / ${container.mem_limit}</td>
                <td>${container.net_io}</td>
                <td>${container.block_io}</td>
            </tr>`;
        });
    }
    
    html += '</table>';
    dockerContainersElement.innerHTML = html;
}

function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'running':
            return 'status-running';
        case 'healthy':
            return 'status-healthy';
        case 'unhealthy':
            return 'status-unhealthy';
        case 'starting':
            return 'status-starting';
        case 'created':
        case 'restarting':
            return 'status-restarting';
        case 'paused':
            return 'status-paused';
        case 'exited':
        case 'dead':
            return 'status-exited';
        default:
            return 'status-unknown';
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
            updateDiskIOMetric(data.disk_io);
            updateNetworkMetric(data.network);
            updateTopProcesses(data.top_processes);
            if ('docker_containers' in data) {
                updateDockerContainers(data.docker_containers);
            } else {
                const dockerContainersElement = document.getElementById('dockerContainers');
                dockerContainersElement.innerHTML = '<p>Docker information is not available.</p>';
            }
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
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    const resetDefaultsButton = document.getElementById('resetDefaults');

    // Define default settings
    const defaultSettings = {
        columnCount: '3',
        scale: '100',
        showHeader: true,
        showGauges: true,
        showDynamicInfo: true,
        showStaticInfo: true,
        showCharts: true,
        displayOrder: [
            { name: 'CPU', visible: true },
            { name: 'Memory', visible: true },
            { name: 'GPU', visible: true },
            { name: 'Disk', visible: true },
            { name: 'Disk', visible: true },
            { name: 'Network', visible: true },
            { name: 'Top', visible: true },
            { name: 'Docker', visible: true }
        ]
    };

    // Function to apply settings
    function applySettings(settings) {
        columnCountSlider.value = settings.columnCount;
        columnCountSlider.dispatchEvent(new Event('input'));
        
        scaleSlider.value = settings.scale;
        scaleSlider.dispatchEvent(new Event('input'));
        
        showHeaderCheckbox.checked = settings.showHeader;
        showHeaderCheckbox.dispatchEvent(new Event('change'));
        
        showGaugesCheckbox.checked = settings.showGauges;
        showGaugesCheckbox.dispatchEvent(new Event('change'));
        
        showDynamicInfoCheckbox.checked = settings.showDynamicInfo;
        showDynamicInfoCheckbox.dispatchEvent(new Event('change'));
        
        showStaticInfoCheckbox.checked = settings.showStaticInfo;
        showStaticInfoCheckbox.dispatchEvent(new Event('change'));
        
        showChartsCheckbox.checked = settings.showCharts;
        showChartsCheckbox.dispatchEvent(new Event('change'));

        // Apply display order and visibility
        const dashboard = document.querySelector('.dashboard');
        settings.displayOrder.forEach((item) => {
            const container = Array.from(dashboard.children).find(c => 
                c.querySelector('.label').textContent.trim().startsWith(item.name)
            );
            if (container) {
                dashboard.appendChild(container);
                container.style.display = item.visible ? 'flex' : 'none';
            }
        });

        createReorderElements();
    }

    // Function to save settings
    function saveSettings() {
        const settings = {
            columnCount: columnCountSlider.value,
            scale: scaleSlider.value,
            showHeader: showHeaderCheckbox.checked,
            showGauges: showGaugesCheckbox.checked,
            showDynamicInfo: showDynamicInfoCheckbox.checked,
            showStaticInfo: showStaticInfoCheckbox.checked,
            showCharts: showChartsCheckbox.checked,
            displayOrder: Array.from(document.querySelectorAll('.metric-container'))
                .map(container => ({
                    name: container.querySelector('.label').textContent.trim().split(' ')[0],
                    visible: container.style.display !== 'none'
                }))
        };

        localStorage.setItem('ezMonitorSettings', JSON.stringify(settings));
    }

    // Function to load settings
    function loadSettings() {
        const savedSettings = localStorage.getItem('ezMonitorSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            applySettings(settings);
        } else {
            applySettings(defaultSettings);
        }
    }

    // Open the modal
    settingsButton.onclick = function() {
        settingsModal.style.display = 'block';
        isSettingsVisible = true;
        handleCursorVisibility(); // Ensure cursor and settings button are visible
    }

    // Close the modal
    closeButton.onclick = function() {
        settingsModal.style.display = 'none';
        isSettingsVisible = false;
        handleCursorVisibility(); // Re-enable hiding
    }

    // Close the modal if clicked outside
    window.onclick = function(event) {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
            isSettingsVisible = false;
            handleCursorVisibility(); // Re-enable hiding
        }
    }

    // Modify createContainerToggles function
    function createContainerToggles() {
        const containers = document.querySelectorAll('.metric-container');
        reorderContainer.innerHTML = '';
        containers.forEach((container) => {
            const label = container.querySelector('.label').childNodes[0].textContent.trim();
            const reorderItem = document.createElement('div');
            reorderItem.className = 'reorder-item';
            reorderItem.draggable = true;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `toggle-${label.toLowerCase()}`;
            checkbox.checked = true;
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = checkbox.id;
            labelElement.appendChild(checkbox);
            
            // Update the label text for Top Processes and Docker Containers
            if (label === 'Top') {
                labelElement.appendChild(document.createTextNode(' Show Top Processes'));
            } else if (label === 'Docker') {
                labelElement.appendChild(document.createTextNode(' Show Docker Containers'));
            } else {
                labelElement.appendChild(document.createTextNode(` Show ${label}`));
            }
            
            containerToggles.appendChild(labelElement);
            
            checkbox.onchange = function() {
                container.style.display = this.checked ? 'flex' : 'none';
                saveSettings();
            }

            // Add default value to defaultSettings
            defaultSettings.containerToggles[checkbox.id] = true;
        });
    }

    // Drag and drop functions
    let draggedItem = null;

    function dragStart() {
        draggedItem = this;
        setTimeout(() => this.style.opacity = '0.5', 0);
    }

    function dragOver(e) {
        e.preventDefault();
    }

    function dragEnter(e) {
        e.preventDefault();
        this.classList.add('over');
    }

    function dragLeave() {
        this.classList.remove('over');
    }

    function drop() {
        this.classList.remove('over');
        if (this !== draggedItem) {
            const allItems = [...reorderContainer.querySelectorAll('.reorder-item')];
            const draggedIndex = allItems.indexOf(draggedItem);
            const droppedIndex = allItems.indexOf(this);

            if (draggedIndex < droppedIndex) {
                reorderContainer.insertBefore(draggedItem, this.nextSibling);
            } else {
                reorderContainer.insertBefore(draggedItem, this);
            }

            // Update the actual metric containers order
            const dashboard = document.querySelector('.dashboard');
            const containers = Array.from(dashboard.querySelectorAll('.metric-container'));
            if (draggedIndex < droppedIndex) {
                dashboard.insertBefore(containers[draggedIndex], containers[droppedIndex].nextSibling);
            } else {
                dashboard.insertBefore(containers[draggedIndex], containers[droppedIndex]);
            }

            saveSettings(); // Save the new order
        }
        draggedItem.style.opacity = '1';
        draggedItem = null;
    }

    // Reset to defaults
    resetDefaultsButton.onclick = function() {
        applySettings(defaultSettings);
        saveSettings();
        
        // Update the dashboard layout
        const dashboard = document.querySelector('.dashboard');
        defaultSettings.displayOrder.forEach((item) => {
            const container = Array.from(dashboard.children).find(c => 
                c.querySelector('.label').textContent.trim().startsWith(item.name)
            );
            if (container) {
                dashboard.appendChild(container);
                container.style.display = item.visible ? 'flex' : 'none';
            }
        });

        // Recreate reorder elements to reflect the new order
        createReorderElements();

        // Update UI elements to reflect default settings
        columnCountValue.textContent = defaultSettings.columnCount;
        scaleValue.textContent = defaultSettings.scale + '%';
        document.querySelector('.scale-container').style.transform = `scale(${defaultSettings.scale / 100})`;
        document.querySelector('.dashboard').style.gridTemplateColumns = `repeat(${defaultSettings.columnCount}, 1fr)`;
    }

    createReorderElements();
    loadSettings(); // Load saved settings
}

// Add this function to handle cursor and settings button visibility
function handleCursorVisibility() {
    document.body.style.cursor = 'default';
    clearTimeout(cursorTimeout);
    clearTimeout(settingsButtonTimeout);
    
    const settingsButton = document.getElementById('settingsButton');
    settingsButton.style.opacity = '1';
    settingsButton.style.transform = 'translateX(0)';
    
    if (!isSettingsVisible) {
        cursorTimeout = setTimeout(() => {
            document.body.style.cursor = 'none';
        }, cursorHideDelay);
        
        settingsButtonTimeout = setTimeout(() => {
            settingsButton.style.opacity = '0';
            settingsButton.style.transform = 'translateX(100%)';
        }, settingsButtonHideDelay);
    }
}

// Add this event listener at the end of your script
document.addEventListener('mousemove', handleCursorVisibility);

// Modify the existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    updateMetrics();
    initializeSettings();  // Add this line to initialize settings
    handleCursorVisibility(); // Add this line to initialize cursor visibility
});

// Remove any duplicate event listeners if they exist