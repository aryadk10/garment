#!/usr/bin/env python3
"""
Check user passwords in database through the API
"""

import requests
import json

base_url = "https://pdf-auth-fix-2.preview.emergentagent.com"
api_url = f"{base_url}/api"

# Login as admin first
response = requests.post(f"{api_url}/auth/login", json={
    "email": "admin@garment.com",
    "password": "Admin@123"
})

if response.status_code != 200:
    print("❌ Admin login failed")
    exit(1)

admin_token = response.json().get('token')
headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}

# Get all users
users_response = requests.get(f"{api_url}/users", headers=headers)
if users_response.status_code == 200:
    users = users_response.json()
    print("All users in system:")
    for u in users:
        print(f"  Email: {u.get('email')}")
        print(f"  Name: {u.get('name')}")
        print(f"  Role: {u.get('role')}")
        print(f"  Status: {u.get('status')}")
        print(f"  Vendor ID: {u.get('vendor_id')}")
        print()

# Get all garments to see stored passwords
garments_response = requests.get(f"{api_url}/garments", headers=headers)
if garments_response.status_code == 200:
    garments = garments_response.json()
    print("Garment vendor accounts:")
    for g in garments:
        print(f"  Garment: {g.get('garment_name')}")
        print(f"  Login Email: {g.get('login_email')}")
        print(f"  Plain Password: '{g.get('vendor_password_plain')}'")
        print()

# Test with the exact credentials from garment
if garments:
    g = garments[0]
    email = g.get('login_email')
    password = g.get('vendor_password_plain')
    
    if email and password:
        print(f"Testing login with exact credentials:")
        print(f"Email: '{email}'")
        print(f"Password: '{password}'")
        
        test_response = requests.post(f"{api_url}/auth/login", json={
            "email": email,
            "password": password
        })
        
        print(f"Result: {test_response.status_code} - {test_response.text}")
        
        if test_response.status_code == 200:
            print("✅ Vendor login successful!")
        else:
            print("❌ Vendor login failed")