# ez_monitor

***ez_monitor*** is a lightweight web application that provides real-time system metrics visualization for your machine. It displays CPU, memory, disk, GPU, disk I/O, and network usage in an easy-to-read dashboard.

![image](https://github.com/user-attachments/assets/1ded3d71-c139-4f70-977b-1758551a4c5e)


## Usage

To use ez_monitor, follow these steps:

1. Clone this repository to your local machine:

```
git clone https://github.com/yourusername/ez_monitor.git
```

2. Change to the cloned directory:

```
cd ez_monitor
```

3. Install the required dependencies:

```
pip install -r requirements.txt
```

4. Run the application:

```
python ez_monitor/app.py
```

5. Access the dashboard in your web browser:

Open a web browser and navigate to `http://localhost:5000/`. You will see a web page displaying real-time system metrics.

### Command-line Arguments

You can customize the behavior of ez_monitor using the following command-line arguments:

- `-p`, `--port`: Specify the port to run the server on (default: 5000)
- `-r`, `--refresh-rate`: Set the refresh rate in seconds (default: 0.5)
- `-m`, `--max-data-points`: Set the maximum number of data points to keep (default: 1800)
- `--debug`: Run the application in debug mode

Example:
```
python ez_monitor/app.py -p 8080 -r 1.5 -m 3600
```

This will run ez_monitor on port 8080, with a refresh rate of 1.5 seconds, and keep up to 3600 data points.

## Features

- Real-time system metrics visualization
- Web-based interface for easy access
- Displays CPU, memory, disk, GPU, disk I/O, and network usage
- Interactive charts for historical data
- Customizable disk selection for multi-disk systems
- Configurable refresh rate and data retention

## Requirements

ez_monitor requires the following:

* Python 3.7+
* Flask
* psutil
* py-cpuinfo
* GPUtil

## License

ez_monitor is released under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you find this project useful, consider buying me a coffee! Donations help keep this project going and are greatly appreciated.

[![Buy me a coffee](https://img.shields.io/badge/-Buy%20me%20a%20coffee-orange?logo=buy-me-a-coffee&logoColor=white&style=for-the-badge)](https://www.buymeacoffee.com/pedro_cf)
