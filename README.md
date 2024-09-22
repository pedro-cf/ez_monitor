# ez_monitor

***ez_monitor*** is a lightweight web application that provides real-time system metrics visualization for your machine. It displays CPU, memory, disk, GPU, disk I/O, and network usage in an easy-to-read dashboard.

![image](https://github.com/user-attachments/assets/1ded3d71-c139-4f70-977b-1758551a4c5e)


## Installation

Since ez_monitor is not yet published on PyPI, you'll need to install it from the source. Follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/pedro-cf/ez_monitor.git
   ```

2. Change to the ez_monitor directory:
   ```
   cd ez_monitor
   ```

3. Install the package:
   ```
   pip install .
   ```

## Usage

After installation, you can run ez_monitor directly from the command line:

```
ez_monitor
```

By default, ez_monitor will start on port 5000. You can access the dashboard by opening a web browser and navigating to `http://localhost:5000/`.

### Command-line Arguments

You can customize the behavior of ez_monitor using the following command-line arguments:

- `-p`, `--port`: Specify the port to run the server on (default: 5000)
- `-r`, `--refresh-rate`: Set the refresh rate in seconds (default: 0.5)
- `-m`, `--max-data-points`: Set the maximum number of data points to keep (default: 1800)
- `--debug`: Run the application in debug mode

Example:
```
ez_monitor -p 8080 -r 1.5 -m 3600 --debug
```

This will run ez_monitor on port 8080, with a refresh rate of 1.5 seconds, keep up to 3600 data points, and run in debug mode.

## Features

- Real-time system metrics visualization
- Web-based interface for easy access
- Displays CPU, memory, disk, GPU, disk I/O, and network usage
- Interactive charts for historical data
- Customizable disk selection for multi-disk systems
- Configurable refresh rate and data retention
- Top processes monitoring: View a list of the top processes consuming system resources, including CPU usage, memory usage, and process status
- Docker container monitoring: If Docker is available on your system, ez_monitor displays information about running containers, including resource usage and status
- Customizable dashboard layout with adjustable columns and scaling
- Ability to show/hide individual metrics and components
- Settings modal for easy configuration of display options
- Scalable interface: Use the scale slider in the settings to resize the entire dashboard, making it easier to fit on different screen sizes
- Persistent settings: Your layout and display preferences are saved and persisted between sessions

### New Features

- **Top Processes**: View a list of the top processes consuming system resources, including CPU usage, memory usage, and process status.
- **Docker Containers**: If Docker is available on your system, ez_monitor now displays information about running containers, including resource usage and status.
- **Customizable Layout**: Adjust the number of columns in the dashboard layout to best fit your screen.
- **Scalable Interface**: Use the scale slider in the settings to resize the entire dashboard, making it easier to fit on different screen sizes.
- **Component Toggles**: Show or hide individual metric components (CPU, Memory, Disk, etc.) as needed.
- **Persistent Settings**: Your layout and display preferences are now saved and persisted between sessions.

## Requirements

ez_monitor requires Python 3.7 or higher. All other dependencies will be automatically installed when you install ez_monitor using pip.

## License

ez_monitor is released under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you find this project useful, consider buying me a coffee! Donations help keep this project going and are greatly appreciated.

[![Buy me a coffee](https://img.shields.io/badge/-Buy%20me%20a%20coffee-orange?logo=buy-me-a-coffee&logoColor=white&style=for-the-badge)](https://www.buymeacoffee.com/pedro_cf)
