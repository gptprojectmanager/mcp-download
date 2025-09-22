import sys
import os
import subprocess
import signal
import platform

proc = None

def handle_termination(signum, frame):
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=1)
        except:
            try:
                proc.kill()
            except:
                pass
    sys.exit(0)

def main():
    global proc

    signal.signal(signal.SIGINT, handle_termination)
    signal.signal(signal.SIGTERM, handle_termination)

    try:
        # Get the directory where the current script is located
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Build the path to dist/index.js
        index_js_path = os.path.join(current_dir, 'dist', 'index.js')

        popen_kwargs = {
            "stdin": sys.stdin,
            "stdout": sys.stdout,
            "stderr": sys.stderr,
            "shell": True,
            "env": os.environ,
        }

        # Add creationflags only on Windows
        if platform.system() == "Windows":
            popen_kwargs["creationflags"] = 0x08000000

        proc = subprocess.Popen(
            f"node {index_js_path}",
            **popen_kwargs
        )

        proc.wait()

    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
    finally:
        if proc and proc.poll() is None:
            handle_termination(None, None)

    sys.exit(proc.returncode if proc else 1)

if __name__ == "__main__":
    main() 