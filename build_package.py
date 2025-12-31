import os
import shutil
import subprocess
from pathlib import Path
import sys

def build():
    # Get project root
    root_dir = Path(__file__).parent.absolute()
    frontend_dir = root_dir / "frontend"
    
    print(f"Project root: {root_dir}")
    
    # 1. Build frontend
    print("\n📦 Building frontend...")
    if not frontend_dir.exists():
        print("Error: frontend directory not found!")
        sys.exit(1)
        
    try:
        # Install dependencies if node_modules doesn't exist
        if not (frontend_dir / "node_modules").exists():
            print("Installing frontend dependencies...")
            subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)
            
        # Build
        print("Running npm build...")
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error building frontend: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: npm not found. Please ensure Node.js is installed.")
        sys.exit(1)
    
    # 2. Copy to claude_viewer/static
    print("\n📂 Copying static files...")
    dist_dir = frontend_dir / "dist"
    target_dir = root_dir / "claude_viewer" / "static"
    
    if not dist_dir.exists():
        print("Error: frontend/dist not found after build!")
        sys.exit(1)
        
    if target_dir.exists():
        print(f"Cleaning existing static directory: {target_dir}")
        shutil.rmtree(target_dir)
    
    print(f"Copying {dist_dir} to {target_dir}")
    shutil.copytree(dist_dir, target_dir)
    
    # 3. Build python package
    print("\n🐍 Building Python package...")
    try:
        # Install build tool if needed
        subprocess.run([sys.executable, "-m", "pip", "install", "build"], check=True)
        
        # Build
        subprocess.run([sys.executable, "-m", "build"], cwd=root_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error building python package: {e}")
        sys.exit(1)
        
    print("\n✅ Build complete! You can now install the package using pip.")
    print(f"Wheel file is located in {root_dir}/dist/")

if __name__ == "__main__":
    build()