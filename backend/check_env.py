import sys
import pkg_resources
import os

def check_environment():
    print("Python version:", sys.version)
    print("Current working directory:", os.getcwd())
    print("\nInstalled packages:")
    for package in pkg_resources.working_set:
        print(f"{package.key} {package.version}")

if __name__ == "__main__":
    check_environment() 