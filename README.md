# ez_monitor

ez_monitor is a simple web application that allows you to view the logs of your Docker containers in a web page. It provides a real-time view of your logs, which can be easily accessed through a web interface.

![image](https://placeholder-for-your-screenshot.com)

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
pip install -r ez_monitor/requirements.txt
```

4. Run the application:

```
python ez_monitor/app.py
```

5. Access the logs in your web browser:

Open a web browser and navigate to `http://localhost:5000/`. You will see a web page displaying logs from all running Docker containers.

The logs are displayed in real-time, with the most recent logs at the bottom. The logs are refreshed automatically to show the latest changes.

You can adjust the refresh rate using the provided controls on the web interface.

## Features

- Real-time log streaming from Docker containers
- Web-based interface for easy access
- Support for multiple containers
- Automatic container discovery
- Customizable refresh rate

## Requirements

ez_monitor requires the following:

* Docker
* Python 3.7+

## Configuration

You can modify the `ez_monitor/app.py` file to customize the behavior of the application, such as changing the port number or adjusting the log fetching logic.

## License

ez_monitor is released under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support


If you find this project useful, consider buying me a coffee! Donations help keep this project going and are greatly appreciated.

[![Buy me a coffee](https://img.shields.io/badge/-Buy%20me%20a%20coffee-orange?logo=buy-me-a-coffee&logoColor=white&style=for-the-badge)](https://www.buymeacoffee.com/pedro_cf)