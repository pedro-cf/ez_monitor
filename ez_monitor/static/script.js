
let cpuMax = 0;
let memoryMax = 0;
let diskMax = 0;
let gpuMax = 0;
const diskSelector = document.getElementById('diskSelector');

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
}

function updateMemoryMetric(memory) {
    const progress = document.getElementById('memoryProgress');
    const percentElement = document.getElementById('memoryPercent');
    const usageElement = document.getElementById('memoryUsage');
    const infoElement = document.getElementById('memoryInfo');
    const maxLine = document.getElementById('memoryMaxLine');
    
    progress.style.width = `${memory.percent}%`;
    percentElement.textContent = `${memory.percent.toFixed(1)}%`;
    usageElement.textContent = `${memory.used} / ${memory.total}`;
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

// Update metrics every second
setInterval(updateMetrics, 1000);