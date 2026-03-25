#!/usr/bin/env python3
"""
Test the new API endpoints for the Garment ERP application:
1. Serial Number in PO Items
2. Production Returns (GET/POST/PUT)
3. Vendor Material Inspections (GET)
4. Material Defect Reports (GET/POST)
"""
import requests
import json
import time
from datetime import datetime, timedelta

# Configuration from review request
BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com/api"
LOGIN_CREDENTIALS = {
    "email": "admin@garment.com",
    "password": "Admin@123"
}

class NewEndpointsTester:
    def __init__(self):
        self.jwt_token = None
        self.headers = {"Content-Type": "application/json"}
        self.test_data = {
            'po_id': None,
            'po_number': None,
            'production_return_id': None,
            'garments': [],
            'production_return': None
        }
        
    def login(self):
        """Authenticate and get JWT token"""
        print("=== AUTHENTICATION TEST ===")
        try:
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json=LOGIN_CREDENTIALS, 
                                   headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                self.jwt_token = data.get('token')
                if self.jwt_token:
                    self.headers["Authorization"] = f"Bearer {self.jwt_token}"
                    print(f"✅ Login successful. User: {data.get('user', {}).get('name', 'Unknown')}")
                    return True
                else:
                    print("❌ No token received in login response")
                    return False
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return False

    def get_vendors_for_testing(self):
        """Get vendors to use valid vendor_id in tests"""
        try:
            response = requests.get(f"{BASE_URL}/garments", headers=self.headers)
            if response.status_code == 200:
                garments = response.json()
                if garments:
                    self.test_data['garments'] = garments
                    print(f"✅ Found {len(garments)} garments/vendors for testing")
                    return True
            print("⚠️  No garments found, will use test-vendor as vendor_id")
            return True
        except Exception as e:
            print(f"❌ Error getting garments: {str(e)}")
            return True  # Continue with default vendor_id

    def test_1_serial_number_in_po_items(self):
        """TEST 1: Serial Number in PO Items"""
        print("\n=== TEST 1: Serial Number in PO Items ===")
        try:
            # Create a Production PO with serial_number field
            po_number = f"TEST-SN-{int(time.time())}"
            po_data = {
                "po_number": po_number,
                "customer_name": "Test Customer For Serial Numbers",
                "po_date": "2025-01-15",
                "status": "Draft",
                "items": [
                    {
                        "product_id": "",  # Empty as specified in review request
                        "product_name": "Test Baju",
                        "qty": 100,
                        "serial_number": "SN-2025-001",
                        "sku": "TEST-001",
                        "size": "M",
                        "color": "Black",
                        "selling_price_snapshot": 50000,
                        "cmt_price_snapshot": 30000
                    }
                ]
            }
            
            response = requests.post(f"{BASE_URL}/production-pos", 
                                   json=po_data, 
                                   headers=self.headers)
            
            if response.status_code == 201:
                po_response = response.json()
                self.test_data['po_id'] = po_response['id']
                self.test_data['po_number'] = po_number
                
                # Verify the response includes serial_number in items
                if 'items' in po_response and len(po_response['items']) > 0:
                    item = po_response['items'][0]
                    if 'serial_number' in item and item['serial_number'] == 'SN-2025-001':
                        print(f"✅ PO created with serial_number: {po_response['po_number']}")
                        print(f"   • Item serial_number: {item['serial_number']}")
                        print(f"   • Item SKU: {item.get('sku', '')}")
                        print(f"   • Item qty: {item.get('qty', 0)}")
                        return True
                    else:
                        print(f"❌ Item missing serial_number field or incorrect value")
                        print(f"   • Item data: {item}")
                        return False
                else:
                    print(f"❌ Response missing items array")
                    return False
            else:
                print(f"❌ Failed to create PO: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {str(e)}")
            return False

    def test_2_production_returns_get(self):
        """TEST 2: Production Returns (GET)"""
        print("\n=== TEST 2: Production Returns (GET) ===")
        try:
            response = requests.get(f"{BASE_URL}/production-returns", headers=self.headers)
            
            if response.status_code == 200:
                returns = response.json()
                print(f"✅ GET /api/production-returns successful")
                print(f"   • Returned {len(returns)} production returns")
                print(f"   • Response type: {type(returns)}")
                
                # Should return an array (may be empty)
                if isinstance(returns, list):
                    print(f"✅ Response is array as expected")
                    return True
                else:
                    print(f"❌ Expected array, got {type(returns)}")
                    return False
            else:
                print(f"❌ GET production-returns failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {str(e)}")
            return False

    def test_3_production_returns_post(self):
        """TEST 3: Production Returns (POST)"""
        print("\n=== TEST 3: Production Returns (POST) ===")
        try:
            # Create a production return as specified in review request
            return_data = {
                "customer_name": "PT Test Customer",
                "return_date": "2025-01-15",
                "return_reason": "Produk Cacat",
                "notes": "Test retur",
                "items": [
                    {
                        "product_name": "Baju Test",
                        "sku": "TEST-001",
                        "size": "M",
                        "color": "Black",
                        "return_qty": 10,
                        "defect_type": "Jahitan Longgar",
                        "repair_notes": "Perlu dijahit ulang"
                    }
                ]
            }
            
            response = requests.post(f"{BASE_URL}/production-returns", 
                                   json=return_data, 
                                   headers=self.headers)
            
            if response.status_code == 201:
                return_response = response.json()
                self.test_data['production_return'] = return_response
                self.test_data['production_return_id'] = return_response['id']
                
                # Verify response structure
                expected_fields = ['return_number', 'status', 'total_return_qty', 'items']
                missing_fields = []
                
                for field in expected_fields:
                    if field not in return_response:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"❌ Missing fields in response: {missing_fields}")
                    return False
                
                # Verify specific values
                return_number = return_response.get('return_number', '')
                status = return_response.get('status', '')
                total_return_qty = return_response.get('total_return_qty', 0)
                items = return_response.get('items', [])
                
                if not return_number.startswith('RTN-'):
                    print(f"❌ Expected return_number format RTN-XXXX, got: {return_number}")
                    return False
                
                if status != 'Repair Needed':
                    print(f"❌ Expected status 'Repair Needed', got: {status}")
                    return False
                
                if total_return_qty != 10:
                    print(f"❌ Expected total_return_qty 10, got: {total_return_qty}")
                    return False
                
                if not isinstance(items, list) or len(items) == 0:
                    print(f"❌ Expected items array with at least 1 item, got: {items}")
                    return False
                
                print(f"✅ Production return created successfully:")
                print(f"   • Return number: {return_number}")
                print(f"   • Status: {status}")
                print(f"   • Total return qty: {total_return_qty}")
                print(f"   • Items count: {len(items)}")
                
                return True
                
            else:
                print(f"❌ Failed to create production return: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {str(e)}")
            return False

    def test_4_production_returns_put(self):
        """TEST 4: Production Returns (PUT)"""
        print("\n=== TEST 4: Production Returns (PUT) ===")
        try:
            if not self.test_data['production_return_id']:
                print("❌ No production return ID available for PUT test")
                return False
            
            # Update the return status to 'In Repair'
            update_data = {
                "status": "In Repair",
                "notes": "Sedang diperbaiki"
            }
            
            return_id = self.test_data['production_return_id']
            response = requests.put(f"{BASE_URL}/production-returns/{return_id}", 
                                  json=update_data, 
                                  headers=self.headers)
            
            if response.status_code == 200:
                updated_return = response.json()
                
                if updated_return.get('status') != 'In Repair':
                    print(f"❌ Expected status 'In Repair', got: {updated_return.get('status')}")
                    return False
                
                if updated_return.get('notes') != 'Sedang diperbaiki':
                    print(f"❌ Expected notes 'Sedang diperbaiki', got: {updated_return.get('notes')}")
                    return False
                
                print(f"✅ Production return updated successfully:")
                print(f"   • Status: {updated_return.get('status')}")
                print(f"   • Notes: {updated_return.get('notes')}")
                
                return True
                
            else:
                print(f"❌ Failed to update production return: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 4 ERROR: {str(e)}")
            return False

    def test_5_vendor_material_inspections_get(self):
        """TEST 5: Vendor Material Inspections (GET)"""
        print("\n=== TEST 5: Vendor Material Inspections (GET) ===")
        try:
            response = requests.get(f"{BASE_URL}/vendor-material-inspections", headers=self.headers)
            
            if response.status_code == 200:
                inspections = response.json()
                print(f"✅ GET /api/vendor-material-inspections successful")
                print(f"   • Returned {len(inspections)} material inspections")
                print(f"   • Response type: {type(inspections)}")
                
                # Should return an array (may be empty)
                if isinstance(inspections, list):
                    print(f"✅ Response is array as expected")
                    
                    # If there are inspections, check structure
                    if len(inspections) > 0:
                        first_inspection = inspections[0]
                        print(f"   • Sample inspection fields: {list(first_inspection.keys())}")
                    
                    return True
                else:
                    print(f"❌ Expected array, got {type(inspections)}")
                    return False
            else:
                print(f"❌ GET vendor-material-inspections failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 5 ERROR: {str(e)}")
            return False

    def test_6_material_defect_reports_get(self):
        """TEST 6: Material Defect Reports (GET)"""
        print("\n=== TEST 6: Material Defect Reports (GET) ===")
        try:
            response = requests.get(f"{BASE_URL}/material-defect-reports", headers=self.headers)
            
            if response.status_code == 200:
                reports = response.json()
                print(f"✅ GET /api/material-defect-reports successful")
                print(f"   • Returned {len(reports)} defect reports")
                print(f"   • Response type: {type(reports)}")
                
                # Should return an array (may be empty)
                if isinstance(reports, list):
                    print(f"✅ Response is array as expected")
                    
                    # If there are reports, check structure
                    if len(reports) > 0:
                        first_report = reports[0]
                        print(f"   • Sample report fields: {list(first_report.keys())}")
                    
                    return True
                else:
                    print(f"❌ Expected array, got {type(reports)}")
                    return False
            else:
                print(f"❌ GET material-defect-reports failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ TEST 6 ERROR: {str(e)}")
            return False

    def test_7_material_defect_reports_post(self):
        """TEST 7: Material Defect Reports (POST)"""
        print("\n=== TEST 7: Material Defect Reports (POST) ===")
        try:
            # Get a valid vendor_id for testing
            vendor_id = 'test-vendor'  # Default fallback
            if self.test_data['garments']:
                vendor_id = self.test_data['garments'][0]['id']
                print(f"   • Using vendor_id: {vendor_id} ({self.test_data['garments'][0]['garment_name']})")
            else:
                print(f"   • Using test vendor_id: {vendor_id}")
            
            # Create a material defect report as specified in review request
            defect_data = {
                "vendor_id": vendor_id,
                "product_name": "Kain Test",
                "sku": "KAIN-001",
                "size": "L",
                "color": "Blue",
                "defect_qty": 5,
                "defect_type": "Material Cacat",
                "description": "Kain robek 5cm",
                "report_date": "2025-01-15"
            }
            
            response = requests.post(f"{BASE_URL}/material-defect-reports", 
                                   json=defect_data, 
                                   headers=self.headers)
            
            if response.status_code == 201:
                defect_response = response.json()
                
                # Verify response structure
                expected_fields = ['id', 'vendor_id', 'product_name', 'sku', 'defect_qty', 'defect_type', 'description']
                
                for field in expected_fields:
                    if field not in defect_response:
                        print(f"❌ Missing field in response: {field}")
                        return False
                
                # Verify specific values
                if defect_response.get('vendor_id') != vendor_id:
                    print(f"❌ Expected vendor_id {vendor_id}, got: {defect_response.get('vendor_id')}")
                    return False
                
                if defect_response.get('product_name') != 'Kain Test':
                    print(f"❌ Expected product_name 'Kain Test', got: {defect_response.get('product_name')}")
                    return False
                
                if defect_response.get('defect_qty') != 5:
                    print(f"❌ Expected defect_qty 5, got: {defect_response.get('defect_qty')}")
                    return False
                
                print(f"✅ Material defect report created successfully:")
                print(f"   • ID: {defect_response.get('id')}")
                print(f"   • Vendor ID: {defect_response.get('vendor_id')}")
                print(f"   • Product: {defect_response.get('product_name')}")
                print(f"   • SKU: {defect_response.get('sku')}")
                print(f"   • Defect qty: {defect_response.get('defect_qty')}")
                print(f"   • Defect type: {defect_response.get('defect_type')}")
                print(f"   • Status: {defect_response.get('status', 'N/A')}")
                
                return True
                
            else:
                print(f"❌ Failed to create material defect report: {response.status_code} - {response.text}")
                
                # If it failed due to vendor_id, try with test-vendor
                if response.status_code == 400 and vendor_id != 'test-vendor':
                    print(f"   • Retrying with test-vendor...")
                    defect_data['vendor_id'] = 'test-vendor'
                    
                    retry_response = requests.post(f"{BASE_URL}/material-defect-reports", 
                                                 json=defect_data, 
                                                 headers=self.headers)
                    
                    if retry_response.status_code == 201:
                        defect_response = retry_response.json()
                        print(f"✅ Material defect report created with test-vendor:")
                        print(f"   • ID: {defect_response.get('id')}")
                        print(f"   • Product: {defect_response.get('product_name')}")
                        return True
                    else:
                        print(f"❌ Retry also failed: {retry_response.status_code} - {retry_response.text}")
                
                return False
                
        except Exception as e:
            print(f"❌ TEST 7 ERROR: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all new endpoint tests"""
        print("🚀 Starting New API Endpoints Testing")
        print("Testing: Serial Numbers, Production Returns, Material Inspections, Defect Reports")
        print("=" * 70)
        
        if not self.login():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return
        
        # Get vendors for testing
        self.get_vendors_for_testing()
            
        test_results = []
        
        # Run all tests
        tests = [
            ("Serial Number in PO Items", self.test_1_serial_number_in_po_items),
            ("Production Returns (GET)", self.test_2_production_returns_get),
            ("Production Returns (POST)", self.test_3_production_returns_post),
            ("Production Returns (PUT)", self.test_4_production_returns_put),
            ("Vendor Material Inspections (GET)", self.test_5_vendor_material_inspections_get),
            ("Material Defect Reports (GET)", self.test_6_material_defect_reports_get),
            ("Material Defect Reports (POST)", self.test_7_material_defect_reports_post)
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                test_results.append((test_name, result))
                if not result:
                    print(f"\n⚠️  Test '{test_name}' failed - continuing with remaining tests...")
            except Exception as e:
                print(f"\n💥 Test '{test_name}' crashed: {str(e)}")
                test_results.append((test_name, False))
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 NEW API ENDPOINTS TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for _, result in test_results if result)
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
        
        print(f"\n📈 Overall Result: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! New API endpoints working correctly.")
        else:
            failed_tests = [name for name, result in test_results if not result]
            print(f"⚠️  Failed tests: {', '.join(failed_tests)}")
            
        # Print summary of created test data
        print(f"\n📋 Test Data Created:")
        if self.test_data['po_number']:
            print(f"   • PO: {self.test_data['po_number']} (ID: {self.test_data['po_id']})")
        if self.test_data['production_return']:
            return_data = self.test_data['production_return']
            print(f"   • Production Return: {return_data.get('return_number')} (Status: {return_data.get('status')})")

if __name__ == "__main__":
    tester = NewEndpointsTester()
    tester.run_all_tests()