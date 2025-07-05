#!/usr/bin/env python3
"""
Setup script for Minus Voice Assistant Testing Environment
Checks dependencies and prepares environment for Day 1 testing
"""
import subprocess
import sys
import os
from pathlib import Path

def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 50)
    print(f"🔧 {title}")
    print("=" * 50)

def print_step(step_num, title):
    """Print a step header"""
    print(f"\n{step_num}. {title}")
    print("-" * 30)

def check_python_version():
    """Check if Python version is compatible"""
    print("🐍 Checking Python version...")
    version = sys.version_info
    print(f"   Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major >= 3 and version.minor >= 8:
        print("   ✅ Python version is compatible")
        return True
    else:
        print("   ❌ Python 3.8+ required")
        return False

def install_dependencies():
    """Install required dependencies"""
    print("📦 Installing dependencies...")
    
    try:
        # Install from requirements.txt
        result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("   ✅ Dependencies installed successfully")
            return True
        else:
            print(f"   ❌ Failed to install dependencies: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error installing dependencies: {e}")
        return False

def create_env_file():
    """Create .env file from example if it doesn't exist"""
    print("🔐 Setting up environment file...")
    
    env_file = Path(".env")
    env_example = Path("env.example")
    
    if env_file.exists():
        print("   ✅ .env file already exists")
        return True
    
    if env_example.exists():
        try:
            # Copy env.example to .env
            with open(env_example, 'r') as src:
                content = src.read()
            
            with open(env_file, 'w') as dst:
                dst.write(content)
            
            print("   ✅ Created .env file from env.example")
            print("   📝 Note: Using mock mode for testing (no API keys required)")
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to create .env file: {e}")
            return False
    else:
        print("   ⚠️ env.example not found, creating basic .env")
        try:
            basic_env = """# Minus Voice Assistant Environment Variables
# For testing, these can be left as-is (mock mode will be used)

# Google AI API (Free tier)
GOOGLE_API_KEY=your_google_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Voice Server Configuration  
VOICE_SERVER_PORT=8001
VOICE_TIMEOUT_SECONDS=3
"""
            with open(env_file, 'w') as f:
                f.write(basic_env)
            
            print("   ✅ Created basic .env file")
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to create basic .env file: {e}")
            return False

def create_directories():
    """Create necessary directories"""
    print("📁 Creating necessary directories...")
    
    directories = ["tokens", "__pycache__"]
    
    for directory in directories:
        try:
            Path(directory).mkdir(exist_ok=True)
            print(f"   ✅ Directory: {directory}")
        except Exception as e:
            print(f"   ❌ Failed to create {directory}: {e}")
            return False
    
    return True

def check_imports():
    """Check if critical imports work"""
    print("📋 Checking critical imports...")
    
    imports_to_test = [
        ("fastapi", "FastAPI framework"),
        ("pydantic", "Data validation"),
        ("uvicorn", "ASGI server"),
        ("dotenv", "Environment variables"),
        ("asyncio", "Async support"),
        ("requests", "HTTP client")
    ]
    
    failed_imports = []
    
    for module_name, description in imports_to_test:
        try:
            __import__(module_name)
            print(f"   ✅ {module_name} - {description}")
        except ImportError:
            print(f"   ❌ {module_name} - {description}")
            failed_imports.append(module_name)
    
    if failed_imports:
        print(f"\n   ⚠️ Failed imports: {', '.join(failed_imports)}")
        print("   💡 Try: pip install -r requirements.txt")
        return False
    
    return True

def check_file_structure():
    """Check if required files exist"""
    print("🗂️ Checking file structure...")
    
    required_files = [
        "requirements.txt",
        "app/main.py",
        "app/core/llm_service.py",
        "app/services/gmail_service.py", 
        "app/services/calendar_service.py",
        "app/routers/voice.py",
        "voice_server.py",
        "test_voice_pipeline.py",
        "test_gmail_voice.py",
        "test_calendar_voice.py"
    ]
    
    missing_files = []
    
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"   ✅ {file_path}")
        else:
            print(f"   ❌ {file_path}")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n   ⚠️ Missing files: {', '.join(missing_files)}")
        return False
    
    return True

def print_next_steps():
    """Print instructions for next steps"""
    print_header("NEXT STEPS")
    
    print("🚀 Your test environment is ready! Here's how to test:")
    print()
    print("   1. Start the server (Terminal 1):")
    print("      python -m uvicorn app.main:app --reload --port 8000")
    print()
    print("   2. Run all tests (Terminal 2):")
    print("      python run_all_tests.py")
    print()
    print("   3. Or run individual tests:")
    print("      python test_voice_pipeline.py")
    print("      python test_gmail_voice.py")
    print("      python test_calendar_voice.py")
    print()
    print("   4. Test API endpoints manually:")
    print("      curl http://localhost:8000/api/v1/voice/health")
    print()
    print("📖 For detailed testing instructions, see: TEST_PLAN.md")

def print_summary(results):
    """Print setup summary"""
    print_header("SETUP SUMMARY")
    
    for step, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {step}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 Environment setup complete! Ready for testing.")
    else:
        print("\n⚠️ Some setup steps failed. Please fix the issues above.")

def main():
    """Main setup function"""
    print("🚀 MINUS VOICE ASSISTANT - TEST ENVIRONMENT SETUP")
    print("=" * 50)
    print("This script will prepare your environment for Day 1 testing.")
    
    # Setup steps
    results = {}
    
    print_step(1, "Python Version Check")
    results["Python Version"] = check_python_version()
    
    print_step(2, "File Structure Check")
    results["File Structure"] = check_file_structure()
    
    print_step(3, "Create Directories")
    results["Directories"] = create_directories()
    
    print_step(4, "Environment File Setup")
    results["Environment File"] = create_env_file()
    
    print_step(5, "Install Dependencies")
    results["Dependencies"] = install_dependencies()
    
    print_step(6, "Import Check")
    results["Imports"] = check_imports()
    
    # Summary
    print_summary(results)
    
    # Next steps
    if all(results.values()):
        print_next_steps()

if __name__ == "__main__":
    main() 