import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_login_and_me():
    print(f"Testing Auth on {BASE_URL}...")
    full_url = f"{BASE_URL}/auth/login"
    print(f"Hitting URL: {full_url}")
    
    # 1. Login
    creds = {"email": "nurse@test.com", "password": "password123"}
    print(f"Logging in as {creds['email']}...")
    try:
        res = requests.post(f"{BASE_URL}/auth/login", json=creds)
        if res.status_code != 200:
            print(f"❌ Login failed: {res.status_code}")
            print(res.text)
            return
        
        data = res.json()
        token = data.get("access_token")
        print("✅ Login successful, got token.")
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    # 2. Check /auth/me
    print("Checking /auth/me...")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        if res.status_code == 200:
            user = res.json()
            print(f"✅ /auth/me successful: {user.get('email')}")
        else:
            print(f"❌ /auth/me failed: {res.status_code}")
            print(res.text)
    except Exception as e:
        print(f"❌ Request error: {e}")

if __name__ == "__main__":
    test_login_and_me()
