#!/usr/bin/env python3
"""
Debug script to check vendor accounts and PDF export authentication
"""

import requests
import json

def check_vendor_accounts():
    """Check available vendor accounts"""
    base_url = "https://pdf-auth-fix-2.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Login as admin first
    response = requests.post(f"{api_url}/auth/login", json={
        "email": "admin@garment.com",
        "password": "Admin@123"
    })
    
    if response.status_code != 200:
        print("❌ Admin login failed")
        return
    
    admin_token = response.json().get('token')
    headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}
    
    # Get garments to check vendor accounts
    garments_response = requests.get(f"{api_url}/garments", headers=headers)
    if garments_response.status_code == 200:
        garments = garments_response.json()
        print(f"Found {len(garments)} garments:")
        for g in garments:
            print(f"  - {g.get('garment_name', 'Unknown')}")
            print(f"    Email: {g.get('login_email', 'N/A')}")
            print(f"    Password: {g.get('vendor_password_plain', 'N/A')}")
            print()
    
    # Get users to see vendor accounts
    users_response = requests.get(f"{api_url}/users", headers=headers)
    if users_response.status_code == 200:
        users = users_response.json()
        vendor_users = [u for u in users if u.get('role') == 'vendor']
        print(f"Found {len(vendor_users)} vendor users:")
        for u in vendor_users:
            print(f"  - {u.get('email', 'Unknown')}: {u.get('name', 'Unknown')}")

if __name__ == "__main__":
    check_vendor_accounts()