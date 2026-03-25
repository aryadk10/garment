#!/usr/bin/env python3
"""
Backend Testing Script for Garment ERP Bug Fixes
Testing specific bug fixes as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

class GarmentERPTester:
    def __init__(self):
        self.token = None
        self.vendor_id = None
        self.po_id = None
        self.item1_id = None
        self.item2_id = None
        self.vendor_shipment_id = None
        self.buyer_shipment_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def authenticate(self):
        """Step 0: Authenticate with admin credentials"""
        try:
            self.log("🔐 Authenticating with admin credentials...")
            response = requests.post(f"{API_URL}/auth/login", json={
                "email": "admin@garment.com",
                "password": "Admin@123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.log(f"✅ Authentication successful! Token: {self.token[:20]}...")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with authorization token"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def create_test_vendor(self):
        """Step 1: Create a garment/vendor"""
        try:
            self.log("🏭 Creating test vendor...")
            response = requests.post(f"{API_URL}/garments", 
                headers=self.get_headers(),
                json={
                    "garment_name": "Test Vendor Alpha",
                    "garment_code": "TVA-001",
                    "location": "Jakarta",
                    "status": "active",
                    "monthly_capacity": 5000
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                self.vendor_id = data.get('id')
                self.log(f"✅ Vendor created successfully! ID: {self.vendor_id}")
                return True
            else:
                self.log(f"❌ Vendor creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Vendor creation error: {str(e)}")
            return False
    
    def create_production_po_with_items(self):
        """Step 2 & 3: Create a Production PO with Items (combined)"""
        try:
            self.log("📋 Creating Production PO with Items...")
            response = requests.post(f"{API_URL}/production-pos",
                headers=self.get_headers(),
                json={
                    "po_number": "PO-TEST-001",
                    "vendor_id": self.vendor_id,
                    "vendor_name": "Test Vendor Alpha",
                    "po_date": "2026-03-25",
                    "deadline": "2026-04-25",
                    "customer_name": "Test Customer",
                    "status": "In Production",
                    "notes": "Test PO",
                    "items": [
                        {
                            "product_id": "dummy-product-1",
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-S-RED",
                            "size": "S",
                            "color": "Red",
                            "qty": 2000,
                            "serial_number": "SN-001",
                            "selling_price_snapshot": 50000,
                            "cmt_price_snapshot": 25000
                        },
                        {
                            "product_id": "dummy-product-2",
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-M-BLUE",
                            "size": "M",
                            "color": "Blue",
                            "qty": 2000,
                            "serial_number": "SN-002",
                            "selling_price_snapshot": 50000,
                            "cmt_price_snapshot": 25000
                        }
                    ]
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                self.po_id = data.get('id')
                items = data.get('items', [])
                if len(items) >= 2:
                    self.item1_id = items[0].get('id')
                    self.item2_id = items[1].get('id')
                self.log(f"✅ Production PO with Items created successfully! PO ID: {self.po_id}, Item IDs: {self.item1_id}, {self.item2_id}")
                return True
            else:
                self.log(f"❌ Production PO creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Production PO creation error: {str(e)}")
            return False
    
    def create_vendor_shipment(self):
        """Step 4: Create Vendor Shipment (NORMAL)"""
        try:
            self.log("🚚 Creating Vendor Shipment...")
            response = requests.post(f"{API_URL}/vendor-shipments",
                headers=self.get_headers(),
                json={
                    "shipment_number": "SJ-VENDOR-001",
                    "vendor_id": self.vendor_id,
                    "vendor_name": "Test Vendor Alpha",
                    "shipment_type": "NORMAL",
                    "status": "Received",
                    "inspection_status": "Pending",
                    "shipment_date": "2026-03-25",
                    "items": [
                        {
                            "po_id": self.po_id,
                            "po_number": "PO-TEST-001",
                            "po_item_id": self.item1_id,
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-S-RED",
                            "size": "S",
                            "color": "Red",
                            "qty_sent": 2000
                        },
                        {
                            "po_id": self.po_id,
                            "po_number": "PO-TEST-001",
                            "po_item_id": self.item2_id,
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-M-BLUE",
                            "size": "M",
                            "color": "Blue",
                            "qty_sent": 2000
                        }
                    ]
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                self.vendor_shipment_id = data.get('id')
                self.log(f"✅ Vendor Shipment created successfully! ID: {self.vendor_shipment_id}")
                return True
            else:
                self.log(f"❌ Vendor Shipment creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Vendor Shipment creation error: {str(e)}")
            return False
    
    def create_buyer_shipment(self):
        """Step 5: Create Buyer Shipment with 2 dispatches"""
        try:
            self.log("📤 Creating Buyer Shipment...")
            response = requests.post(f"{API_URL}/buyer-shipments",
                headers=self.get_headers(),
                json={
                    "shipment_number": "SJ-BUYER-001",
                    "po_id": self.po_id,
                    "po_number": "PO-TEST-001",
                    "vendor_id": self.vendor_id,
                    "vendor_name": "Test Vendor Alpha",
                    "customer_name": "Test Customer",
                    "shipment_date": "2026-03-25",
                    "items": [
                        {
                            "po_item_id": self.item1_id,
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-S-RED",
                            "serial_number": "SN-001",
                            "size": "S",
                            "color": "Red",
                            "ordered_qty": 2000,
                            "qty_shipped": 500
                        },
                        {
                            "po_item_id": self.item2_id,
                            "product_name": "T-Shirt Basic",
                            "sku": "TSB-001-M-BLUE",
                            "serial_number": "SN-002",
                            "size": "M",
                            "color": "Blue",
                            "ordered_qty": 2000,
                            "qty_shipped": 300
                        }
                    ]
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                self.buyer_shipment_id = data.get('id')
                self.log(f"✅ Buyer Shipment created successfully! ID: {self.buyer_shipment_id}")
                return True
            else:
                self.log(f"❌ Buyer Shipment creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Buyer Shipment creation error: {str(e)}")
            return False
    
    def test_distribusi_kerja_no_undefined(self):
        """Test 1: Distribusi Kerja - No undefined rows"""
        try:
            self.log("🔍 Testing Distribusi Kerja - No undefined rows...")
            response = requests.get(f"{API_URL}/distribusi-kerja", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                # Check structure
                if 'hierarchy' not in data or 'flat' not in data or 'invalid_records' not in data:
                    self.log("❌ Missing required fields: hierarchy, flat, invalid_records")
                    return False
                
                # Check flat array has valid data
                flat_items = data.get('flat', [])
                if not flat_items:
                    self.log("❌ Flat array is empty")
                    return False
                
                # Check each item has non-empty po_number and vendor_name
                for item in flat_items:
                    if not item.get('po_number') or not item.get('vendor_name'):
                        self.log(f"❌ Item has empty po_number or vendor_name: {item}")
                        return False
                
                # Check invalid_records should be empty (all shipments have valid PO mapping)
                invalid_records = data.get('invalid_records', [])
                if invalid_records:
                    self.log(f"❌ Found invalid records: {len(invalid_records)} items")
                    return False
                
                # Check hierarchy has progress_pct field
                hierarchy = data.get('hierarchy', [])
                for vendor in hierarchy:
                    if 'progress_pct' not in vendor:
                        self.log(f"❌ Vendor missing progress_pct: {vendor}")
                        return False
                
                self.log(f"✅ Distribusi Kerja test passed! Found {len(flat_items)} valid items, {len(invalid_records)} invalid")
                return True
            else:
                self.log(f"❌ Distribusi Kerja request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Distribusi Kerja test error: {str(e)}")
            return False
    
    def test_buyer_shipment_list_fixed_denominator(self):
        """Test 2: Buyer Shipment List - Fixed denominator"""
        try:
            self.log("🔍 Testing Buyer Shipment List - Fixed denominator...")
            response = requests.get(f"{API_URL}/buyer-shipments", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                if not data:
                    self.log("❌ No buyer shipments found")
                    return False
                
                shipment = data[0]  # Get first shipment
                
                # Check required fields
                required_fields = ['total_ordered', 'total_shipped', 'remaining', 'progress_pct']
                for field in required_fields:
                    if field not in shipment:
                        self.log(f"❌ Missing field: {field}")
                        return False
                
                # Verify calculations
                total_ordered = shipment.get('total_ordered', 0)
                total_shipped = shipment.get('total_shipped', 0)
                remaining = shipment.get('remaining', 0)
                progress_pct = shipment.get('progress_pct', 0)
                
                # Expected: total_ordered = 4000 (2000 + 2000 from original PO)
                if total_ordered != 4000:
                    self.log(f"❌ Expected total_ordered=4000, got {total_ordered}")
                    return False
                
                # Expected: total_shipped = 800 (500 + 300)
                if total_shipped != 800:
                    self.log(f"❌ Expected total_shipped=800, got {total_shipped}")
                    return False
                
                # Expected: remaining = 3200
                if remaining != 3200:
                    self.log(f"❌ Expected remaining=3200, got {remaining}")
                    return False
                
                # Expected: progress_pct = 20 (800/4000 * 100)
                if progress_pct != 20:
                    self.log(f"❌ Expected progress_pct=20, got {progress_pct}")
                    return False
                
                self.log(f"✅ Buyer Shipment List test passed! total_ordered={total_ordered}, total_shipped={total_shipped}, remaining={remaining}, progress_pct={progress_pct}")
                return True
            else:
                self.log(f"❌ Buyer Shipments request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Buyer Shipment List test error: {str(e)}")
            return False
    
    def test_buyer_shipment_detail_dispatch_history(self):
        """Test 3: Buyer Shipment Detail - Dispatch history"""
        try:
            self.log("🔍 Testing Buyer Shipment Detail - Dispatch history...")
            response = requests.get(f"{API_URL}/buyer-shipments/{self.buyer_shipment_id}", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['dispatches', 'summary_items', 'total_ordered', 'total_shipped', 'remaining', 'progress_pct']
                for field in required_fields:
                    if field not in data:
                        self.log(f"❌ Missing field: {field}")
                        return False
                
                # Check dispatches array
                dispatches = data.get('dispatches', [])
                if not dispatches:
                    self.log("❌ No dispatches found")
                    return False
                
                # Check each dispatch structure
                for dispatch in dispatches:
                    required_dispatch_fields = ['dispatch_seq', 'dispatch_date', 'items', 'total_qty']
                    for field in required_dispatch_fields:
                        if field not in dispatch:
                            self.log(f"❌ Dispatch missing field: {field}")
                            return False
                
                # Check summary_items
                summary_items = data.get('summary_items', [])
                if not summary_items:
                    self.log("❌ No summary_items found")
                    return False
                
                self.log(f"✅ Buyer Shipment Detail test passed! Found {len(dispatches)} dispatches, {len(summary_items)} summary items")
                return True
            else:
                self.log(f"❌ Buyer Shipment Detail request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Buyer Shipment Detail test error: {str(e)}")
            return False
    
    def test_buyer_shipment_dispatches_endpoint(self):
        """Test 4: Buyer Shipment Dispatches endpoint"""
        try:
            self.log("🔍 Testing Buyer Shipment Dispatches endpoint...")
            response = requests.get(f"{API_URL}/buyer-shipment-dispatches?shipment_id={self.buyer_shipment_id}", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log("❌ Response should be an array")
                    return False
                
                if not data:
                    self.log("❌ No dispatches found")
                    return False
                
                # Check each dispatch structure
                for dispatch in data:
                    required_fields = ['dispatch_seq', 'dispatch_date', 'items', 'total_qty']
                    for field in required_fields:
                        if field not in dispatch:
                            self.log(f"❌ Dispatch missing field: {field}")
                            return False
                
                self.log(f"✅ Buyer Shipment Dispatches test passed! Found {len(data)} dispatches")
                return True
            else:
                self.log(f"❌ Buyer Shipment Dispatches request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Buyer Shipment Dispatches test error: {str(e)}")
            return False
    
    def test_distribusi_kerja_shipment_type_tracking(self):
        """Test 5: Distribusi Kerja - Shipment type tracking"""
        try:
            self.log("🔍 Testing Distribusi Kerja - Shipment type tracking...")
            response = requests.get(f"{API_URL}/distribusi-kerja", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                flat_items = data.get('flat', [])
                
                if not flat_items:
                    self.log("❌ No flat items found")
                    return False
                
                # Check each item has shipment_type field
                for item in flat_items:
                    if 'shipment_type' not in item:
                        self.log(f"❌ Item missing shipment_type: {item}")
                        return False
                    
                    # All test data should show shipment_type = "NORMAL"
                    if item.get('shipment_type') != 'NORMAL':
                        self.log(f"❌ Expected shipment_type=NORMAL, got {item.get('shipment_type')}")
                        return False
                
                self.log(f"✅ Distribusi Kerja shipment type test passed! All {len(flat_items)} items have shipment_type=NORMAL")
                return True
            else:
                self.log(f"❌ Distribusi Kerja request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Distribusi Kerja shipment type test error: {str(e)}")
            return False
    
    def test_production_po_serial_numbers(self):
        """Test 6: Production PO with serial numbers"""
        try:
            self.log("🔍 Testing Production PO with serial numbers...")
            response = requests.get(f"{API_URL}/production-pos", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                if not data:
                    self.log("❌ No production POs found")
                    return False
                
                # Find our test PO
                test_po = None
                for po in data:
                    if po.get('po_number') == 'PO-TEST-001':
                        test_po = po
                        break
                
                if not test_po:
                    self.log("❌ Test PO not found")
                    return False
                
                # Check serial_numbers array
                if 'serial_numbers' not in test_po:
                    self.log("❌ Missing serial_numbers field")
                    return False
                
                serial_numbers = test_po.get('serial_numbers', [])
                expected_serials = ['SN-001', 'SN-002']
                
                if not all(sn in serial_numbers for sn in expected_serials):
                    self.log(f"❌ Expected serial numbers {expected_serials}, got {serial_numbers}")
                    return False
                
                # Check composite_label
                if 'composite_label' not in test_po:
                    self.log("❌ Missing composite_label field")
                    return False
                
                self.log(f"✅ Production PO serial numbers test passed! Found serial_numbers: {serial_numbers}")
                return True
            else:
                self.log(f"❌ Production POs request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Production PO serial numbers test error: {str(e)}")
            return False
    
    def test_reports_still_work(self):
        """Test 7: Reports still work"""
        try:
            self.log("🔍 Testing Reports still work...")
            
            # Test production report
            response1 = requests.get(f"{API_URL}/reports/production", headers=self.get_headers())
            if response1.status_code != 200:
                self.log(f"❌ Production report failed: {response1.status_code}")
                return False
            
            production_data = response1.json()
            if not isinstance(production_data, list):
                self.log("❌ Production report should return array")
                return False
            
            # Test shipment report
            response2 = requests.get(f"{API_URL}/reports/shipment", headers=self.get_headers())
            if response2.status_code != 200:
                self.log(f"❌ Shipment report failed: {response2.status_code}")
                return False
            
            shipment_data = response2.json()
            if not isinstance(shipment_data, list):
                self.log("❌ Shipment report should return array")
                return False
            
            self.log(f"✅ Reports test passed! Production: {len(production_data)} items, Shipment: {len(shipment_data)} items")
            return True
            
        except Exception as e:
            self.log(f"❌ Reports test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting Garment ERP Bug Fix Testing...")
        
        # Setup phase
        if not self.authenticate():
            return False
        
        if not self.create_test_vendor():
            return False
        
        if not self.create_production_po_with_items():
            return False
        
        if not self.create_vendor_shipment():
            return False
        
        if not self.create_buyer_shipment():
            return False
        
        # Testing phase
        tests = [
            ("Distribusi Kerja - No undefined rows", self.test_distribusi_kerja_no_undefined),
            ("Buyer Shipment List - Fixed denominator", self.test_buyer_shipment_list_fixed_denominator),
            ("Buyer Shipment Detail - Dispatch history", self.test_buyer_shipment_detail_dispatch_history),
            ("Buyer Shipment Dispatches endpoint", self.test_buyer_shipment_dispatches_endpoint),
            ("Distribusi Kerja - Shipment type tracking", self.test_distribusi_kerja_shipment_type_tracking),
            ("Production PO with serial numbers", self.test_production_po_serial_numbers),
            ("Reports still work", self.test_reports_still_work),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n--- Testing: {test_name} ---")
            if test_func():
                passed += 1
            else:
                failed += 1
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log(f"🎯 TESTING COMPLETE!")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        self.log(f"{'='*60}")
        
        return failed == 0

if __name__ == "__main__":
    tester = GarmentERPTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)