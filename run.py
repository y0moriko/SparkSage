"""Manager launcher: wraps the main app in a restart loop."""

import subprocess
import sys
import time
import os

def run_manager():
    # Use the current python interpreter
    python_exe = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "main_launcher.py")

    print("=" * 50)
    print("  SparkSage Manager — Auto-Restart Enabled")
    print("=" * 50)

    try:
        while True:
            print(f"\n[Manager] Starting main application...")
            # Use subprocess to run the actual bot/API
            # Passing all arguments to the subprocess
            process = subprocess.Popen([python_exe, script_path] + sys.argv[1:])
            
            # Wait for the process to exit
            exit_code = process.wait()
            
            if exit_code == 0:
                print(f"\n[Manager] Application exited normally (0). Restarting in 2s...")
                time.sleep(2)
            else:
                print(f"\n[Manager] Application crashed or stopped (exit code: {exit_code}).")
                print(f"[Manager] Restarting in 5s... (Ctrl+C to stop)")
                time.sleep(5)

    except KeyboardInterrupt:
        print("\n[Manager] Shutting down...")

if __name__ == "__main__":
    run_manager()
