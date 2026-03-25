#!/usr/bin/env python3
"""
Debug test to investigate the work order completion quantity issue
"""

import requests
import json

BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"email": "admin@garment.com", "password": "Admin@123"}

def login():
    response = requests.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDENTIALS)
    return response.json()["token"]

def make_request(method, endpoint, token, data=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    
    return response.json()

if __name__ == "__main__":
    token = login()
    
    # Get recent work orders
    work_orders = make_request("GET", "/work-orders", token)
    print("Recent Work Orders:")
    for wo in work_orders[-2:]:  # Last 2 work orders
        print(f"  ID: {wo['id']}")
        print(f"  Distribution Code: {wo['distribution_code']}")
        print(f"  Status: {wo['status']}")
        print(f"  Quantity: {wo['quantity']}")
        print(f"  Completed Quantity: {wo['completed_quantity']}")
        print("  ---")
        
        # Get progress for this work order
        progress = make_request("GET", f"/production-progress?work_order_id={wo['id']}", token)
        print(f"  Progress records: {len(progress)}")
        total_progress = sum(p['completed_quantity'] for p in progress)
        print(f"  Total progress quantity: {total_progress}")
        print("  ===")