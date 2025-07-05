# TESTS DIRECTORY

## 📂 Structure

```
tests/
├── README.md                    # This file
├── setup_test_environment.py    # Environment setup and dependency checking
├── run_all_tests.py            # Main test runner for all tests
├── integration/                 # Integration tests (API + service level)
│   ├── test_voice_pipeline.py  # Voice pipeline integration tests
│   ├── test_gmail_voice.py     # Gmail voice integration tests
│   └── test_calendar_voice.py  # Calendar voice integration tests
└── unit/                       # Unit tests (individual functions)
    └── (future unit tests)
```

## 🚀 Quick Start

```bash
# Run all tests
cd tests
python run_all_tests.py

# Run specific test
cd integration
python test_voice_pipeline.py
```

## 🧪 Test Types

### **Integration Tests** (`integration/`)
- Test complete workflows (voice → LLM → service → response)
- Test API endpoints with real HTTP requests  
- Test service interactions with mock data
- End-to-end functionality validation

### **Unit Tests** (`unit/`) 
- Test individual functions in isolation
- Test edge cases and error conditions
- Fast execution, no external dependencies
- (To be implemented as needed)

## 📝 Test Status

| Test File | Status | Coverage | Mock/Real |
|-----------|---------|----------|-----------|
| `test_voice_pipeline.py` | ✅ Passing | Voice + LLM + Routing | Mock |
| `test_gmail_voice.py` | ✅ Passing | Gmail Commands | Mock |  
| `test_calendar_voice.py` | ✅ Passing | Calendar Commands | Mock |

**Note**: All tests currently use **mock data** for development without API dependencies. 