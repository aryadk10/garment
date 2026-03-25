#!/usr/bin/env python3
"""
Test vendor authentication specifically
"""

import requests
import json

base_url = "https://pdf-auth-fix-2.preview.emergentagent.com"
api_url = f"{base_url}/api"

# Try vendor login
print("Testing vendor authentication:")
print("Email: vendor.grmcwd@garment.com")
print("Password: ccehMu6y@S")

response = requests.post(f"{api_url}/auth/login", json={
    "email": "vendor.grmcwd@garment.com", 
    "password": "ccehMu6y@S"
}, timeout=10)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    data = response.json()
    token = data.get('token')
    user = data.get('user', {})
    print(f"✅ Login successful!")
    print(f"Role: {user.get('role')}")
    print(f"Vendor ID: {user.get('vendor_id')}")
    
    # Test vendor dashboard
    vendor_headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    dashboard_response = requests.get(f"{api_url}/vendor/dashboard", headers=vendor_headers, timeout=10)
    print(f"Dashboard status: {dashboard_response.status_code}")
    if dashboard_response.status_code == 200:
        print("✅ Vendor dashboard accessible")
    else:
        print(f"❌ Vendor dashboard failed: {dashboard_response.text}")
else:
    print(f"❌ Login failed: {response.text}")