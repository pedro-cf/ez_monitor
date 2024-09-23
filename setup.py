from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="ez_monitor",
    version="1.0.0",
    author="Pedro Fernandes",
    author_email="your.email@example.com",
    description="A lightweight system metrics visualization tool",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/pedro-cf/ez_monitor",
    packages=find_packages(),
    include_package_data=True,
    package_data={'ez_monitor': ['static/*', 'templates/*']},
    install_requires=[
        "Flask==2.0.3",
        "Werkzeug==2.0.3",
        "Jinja2==3.0.3",
        "itsdangerous==2.0.1",
        "click==8.0.4",
        "psutil==5.9.0",
        "flask-cors==5.0.0",
        "py-cpuinfo==9.0.0",
        "GPUtil==1.4.0",
        "requests==2.26.0",
        "pywin32==301; platform_system=='Windows'",
        "docker==7.1.0",
    ],
    extras_require={
        'windows': ["pywin32==301"],
    },
    entry_points={
        "console_scripts": [
            "ez_monitor=ez_monitor.app:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
)
