#!/usr/bin/env python3
"""
Invoice Adjustments Testing - Focused test for invoice adjustments functionality
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@garment.com"
ADMIN_PASSWORD = "Admin@123"

def get_auth_token():
    """Get authentication token"""
    response = requests.post(f"{API_BASE}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get('token')
    return None

def test_invoice_adjustments():
    """Test invoice adjustments functionality"""
    token = get_auth_token()
    if not token:
        print("❌ Authentication failed")
        return
    
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print("🧪 Testing Invoice Adjustments Functionality")
    print("=" * 50)
    
    # Step 1: Create a test invoice using manual invoice creation
    print("\n1. Creating test invoice...")
    
    # First, let's check what POs exist
    pos_response = requests.get(f"{API_BASE}/production-pos", headers=headers)
    if pos_response.status_code == 200:
        pos = pos_response.json()
        if len(pos) > 0:
            po_id = pos[0]['id']
            print(f"✅ Found PO to use: {po_id}")
            
            # Create manual invoice
            invoice_data = {
                "invoice_number": f"TEST-ADJ-{int(datetime.now().timestamp())}",
                "invoice_type": "MANUAL",
                "invoice_category": "VENDOR", 
                "source_po_id": po_id,
                "total_amount": 1000000,
                "vendor_or_customer_name": "Test Vendor for Adjustments",
                "status": "Unpaid"
            }
            
            invoice_response = requests.post(f"{API_BASE}/invoices", json=invoice_data, headers=headers)
            if invoice_response.status_code == 201:
                invoice = invoice_response.json()
                invoice_id = invoice['id']
                print(f"✅ Created test invoice: {invoice_id}")
                
                # Step 2: Test creating adjustments
                print(f"\n2. Testing invoice adjustments for invoice {invoice_id}...")
                
                # Create ADD adjustment
                add_adj = {
                    "invoice_id": invoice_id,
                    "adjustment_type": "ADD",
                    "amount": 50000,
                    "reason": "Tambahan barang",
                    "notes": "Test ADD adjustment"
                }
                
                add_response = requests.post(f"{API_BASE}/invoice-adjustments", json=add_adj, headers=headers)
                if add_response.status_code == 201:
                    add_adj_data = add_response.json()
                    print(f"✅ ADD adjustment created: {add_adj_data.get('id')}")
                else:
                    print(f"❌ ADD adjustment failed: {add_response.status_code} - {add_response.text}")
                
                # Create DEDUCT adjustment
                deduct_adj = {
                    "invoice_id": invoice_id,
                    "adjustment_type": "DEDUCT", 
                    "amount": 20000,
                    "reason": "Potongan defect",
                    "notes": "Test DEDUCT adjustment"
                }
                
                deduct_response = requests.post(f"{API_BASE}/invoice-adjustments", json=deduct_adj, headers=headers)
                if deduct_response.status_code == 201:
                    deduct_adj_data = deduct_response.json()
                    print(f"✅ DEDUCT adjustment created: {deduct_adj_data.get('id')}")
                else:
                    print(f"❌ DEDUCT adjustment failed: {deduct_response.status_code} - {deduct_response.text}")
                
                # Step 3: Verify invoice has adjustments
                print(f"\n3. Verifying invoice adjustments...")
                
                invoice_detail_response = requests.get(f"{API_BASE}/invoices/{invoice_id}", headers=headers)
                if invoice_detail_response.status_code == 200:
                    invoice_detail = invoice_detail_response.json()
                    adjustments = invoice_detail.get('adjustments', [])
                    base_amount = invoice_detail.get('base_amount', 0)
                    adjusted_total = invoice_detail.get('adjusted_total', 0)
                    
                    print(f"✅ Invoice has {len(adjustments)} adjustments")
                    print(f"✅ Base amount: {base_amount}")
                    print(f"✅ Adjusted total: {adjusted_total}")
                    
                    expected_total = base_amount + 50000 - 20000
                    if adjusted_total == expected_total:
                        print(f"✅ Adjusted total calculation correct: {adjusted_total}")
                    else:
                        print(f"❌ Adjusted total incorrect. Expected: {expected_total}, Got: {adjusted_total}")
                else:
                    print(f"❌ Could not get invoice details: {invoice_detail_response.status_code}")
                
                # Step 4: Test getting adjustments by invoice_id
                print(f"\n4. Testing GET adjustments by invoice_id...")
                
                get_adj_response = requests.get(f"{API_BASE}/invoice-adjustments?invoice_id={invoice_id}", headers=headers)
                if get_adj_response.status_code == 200:
                    adj_list = get_adj_response.json()
                    print(f"✅ Retrieved {len(adj_list)} adjustments via GET")
                    for adj in adj_list:
                        print(f"   - {adj.get('adjustment_type')}: {adj.get('amount')} ({adj.get('reason')})")
                else:
                    print(f"❌ Could not get adjustments: {get_adj_response.status_code} - {get_adj_response.text}")
                
                # Step 5: Test validation errors
                print(f"\n5. Testing validation errors...")
                
                # Missing invoice_id
                invalid_adj = {"adjustment_type": "ADD", "amount": 1000, "reason": "Test"}
                val_response = requests.post(f"{API_BASE}/invoice-adjustments", json=invalid_adj, headers=headers)
                if val_response.status_code == 400:
                    print("✅ Correctly rejected missing invoice_id")
                else:
                    print(f"❌ Should reject missing invoice_id: {val_response.status_code}")
                
                # Invalid adjustment_type
                invalid_adj2 = {"invoice_id": invoice_id, "adjustment_type": "INVALID", "amount": 1000, "reason": "Test"}
                val_response2 = requests.post(f"{API_BASE}/invoice-adjustments", json=invalid_adj2, headers=headers)
                if val_response2.status_code == 400:
                    print("✅ Correctly rejected invalid adjustment_type")
                else:
                    print(f"❌ Should reject invalid adjustment_type: {val_response2.status_code}")
                
                # Amount 0
                invalid_adj3 = {"invoice_id": invoice_id, "adjustment_type": "ADD", "amount": 0, "reason": "Test"}
                val_response3 = requests.post(f"{API_BASE}/invoice-adjustments", json=invalid_adj3, headers=headers)
                if val_response3.status_code == 400:
                    print("✅ Correctly rejected amount 0")
                else:
                    print(f"❌ Should reject amount 0: {val_response3.status_code}")
                
                print(f"\n🎉 Invoice Adjustments Testing Complete!")
                
            else:
                print(f"❌ Could not create test invoice: {invoice_response.status_code} - {invoice_response.text}")
        else:
            print("❌ No POs found to create invoice")
    else:
        print(f"❌ Could not get POs: {pos_response.status_code}")

if __name__ == "__main__":
    test_invoice_adjustments()