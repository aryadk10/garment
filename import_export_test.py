#!/usr/bin/env python3
"""
Backend Testing Script for Garment ERP Import/Export Features
Testing NEW import/export API endpoints as requested in the review.
"""

import requests
import json
import sys
import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows

# Configuration
BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

class ImportExportTester:
    def __init__(self):
        self.token = None
        self.vendor_id = None
        self.product_id = None
        self.po_id = None
        
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
    
    def get_headers_multipart(self):
        """Get headers for multipart form data"""
        return {
            "Authorization": f"Bearer {self.token}"
        }
    
    def create_excel_file(self, data, sheet_name="Sheet1"):
        """Create Excel file in memory from data"""
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name
        
        if data:
            # Add headers
            headers = list(data[0].keys())
            ws.append(headers)
            
            # Add data rows
            for row in data:
                ws.append([row.get(h, '') for h in headers])
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        return excel_buffer.getvalue()
    
    def test_import_template_download(self):
        """Test 1: Import Template Download (GET /api/import-template)"""
        try:
            self.log("📥 Testing Import Template Download...")
            
            # Test 1a: Products template
            response = requests.get(f"{API_URL}/import-template?type=products", headers=self.get_headers())
            if response.status_code != 200:
                self.log(f"❌ Products template failed: {response.status_code}")
                return False
            
            if 'spreadsheet' not in response.headers.get('Content-Type', ''):
                self.log(f"❌ Products template wrong content type: {response.headers.get('Content-Type')}")
                return False
            
            # Test 1b: Garments template
            response = requests.get(f"{API_URL}/import-template?type=garments", headers=self.get_headers())
            if response.status_code != 200:
                self.log(f"❌ Garments template failed: {response.status_code}")
                return False
            
            # Test 1c: Production POs template
            response = requests.get(f"{API_URL}/import-template?type=production-pos", headers=self.get_headers())
            if response.status_code != 200:
                self.log(f"❌ Production POs template failed: {response.status_code}")
                return False
            
            # Test 1d: Invalid type should return 400
            response = requests.get(f"{API_URL}/import-template?type=invalid", headers=self.get_headers())
            if response.status_code != 400:
                self.log(f"❌ Invalid type should return 400, got {response.status_code}")
                return False
            
            self.log("✅ Import Template Download tests passed!")
            return True
            
        except Exception as e:
            self.log(f"❌ Import Template Download test error: {str(e)}")
            return False
    
    def test_import_products(self):
        """Test 2a: Import Products"""
        try:
            self.log("📦 Testing Import Products...")
            
            # Create test Excel data
            products_data = [
                {
                    'product_code': 'TEST-PRD-001',
                    'product_name': 'Test T-Shirt',
                    'category': 'Apparel',
                    'cmt_price': 25000,
                    'selling_price': 75000,
                    'variant_sku': 'TST-S-RED',
                    'variant_size': 'S',
                    'variant_color': 'Red'
                },
                {
                    'product_code': 'TEST-PRD-001',
                    'product_name': 'Test T-Shirt',
                    'category': 'Apparel',
                    'cmt_price': 25000,
                    'selling_price': 75000,
                    'variant_sku': 'TST-M-RED',
                    'variant_size': 'M',
                    'variant_color': 'Red'
                },
                {
                    'product_code': 'TEST-PRD-002',
                    'product_name': 'Test Pants',
                    'category': 'Bottoms',
                    'cmt_price': 35000,
                    'selling_price': 95000,
                    'variant_sku': 'TST-L-BLU',
                    'variant_size': 'L',
                    'variant_color': 'Blue'
                }
            ]
            
            excel_data = self.create_excel_file(products_data)
            
            # Upload file
            files = {'file': ('products.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data = {'type': 'products'}
            
            response = requests.post(f"{API_URL}/import-data", 
                                   headers=self.get_headers_multipart(),
                                   files=files,
                                   data=data)
            
            if response.status_code != 201:
                self.log(f"❌ Import products failed: {response.status_code} - {response.text}")
                return False
            
            result = response.json()
            
            # Verify results
            if result.get('imported_products', 0) < 2:
                self.log(f"❌ Expected at least 2 products, got {result.get('imported_products')}")
                return False
            
            if result.get('imported_variants', 0) < 3:
                self.log(f"❌ Expected at least 3 variants, got {result.get('imported_variants')}")
                return False
            
            # Verify products exist in system
            response = requests.get(f"{API_URL}/products", headers=self.get_headers())
            if response.status_code == 200:
                products = response.json()
                test_products = [p for p in products if p.get('product_code', '').startswith('TEST-PRD')]
                if len(test_products) < 2:
                    self.log(f"❌ Expected at least 2 test products in system, found {len(test_products)}")
                    return False
                
                # Store first product ID for later use
                self.product_id = test_products[0].get('id')
            
            self.log(f"✅ Import Products test passed! Imported {result.get('imported_products')} products, {result.get('imported_variants')} variants")
            return True
            
        except Exception as e:
            self.log(f"❌ Import Products test error: {str(e)}")
            return False
    
    def test_import_garments(self):
        """Test 2b: Import Garments"""
        try:
            self.log("🏭 Testing Import Garments...")
            
            # Use timestamp to ensure unique codes
            timestamp = str(int(datetime.now().timestamp()))
            
            # Create test Excel data
            garments_data = [
                {
                    'garment_code': f'TEST-GRM-{timestamp}-001',
                    'garment_name': 'Test Vendor Alpha',
                    'location': 'Jakarta',
                    'contact_person': 'John Doe',
                    'phone': '08123456789',
                    'monthly_capacity': 5000
                },
                {
                    'garment_code': f'TEST-GRM-{timestamp}-002',
                    'garment_name': 'Test Vendor Beta',
                    'location': 'Bandung',
                    'contact_person': 'Jane Smith',
                    'phone': '08198765432',
                    'monthly_capacity': 8000
                }
            ]
            
            excel_data = self.create_excel_file(garments_data)
            
            # Upload file
            files = {'file': ('garments.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data = {'type': 'garments'}
            
            response = requests.post(f"{API_URL}/import-data", 
                                   headers=self.get_headers_multipart(),
                                   files=files,
                                   data=data)
            
            if response.status_code != 201:
                self.log(f"❌ Import garments failed: {response.status_code} - {response.text}")
                return False
            
            result = response.json()
            
            # Verify results
            if result.get('imported_garments', 0) < 2:
                self.log(f"❌ Expected at least 2 garments, got {result.get('imported_garments')}")
                return False
            
            vendor_accounts = result.get('vendor_accounts', [])
            if len(vendor_accounts) < 2:
                self.log(f"❌ Expected at least 2 vendor accounts, got {len(vendor_accounts)}")
                return False
            
            # Verify each account has email and password
            for account in vendor_accounts:
                if not account.get('email') or not account.get('password'):
                    self.log(f"❌ Vendor account missing email or password: {account}")
                    return False
            
            # Verify garments exist in system
            response = requests.get(f"{API_URL}/garments", headers=self.get_headers())
            if response.status_code == 200:
                garments = response.json()
                test_garments = [g for g in garments if g.get('garment_code', '').startswith(f'TEST-GRM-{timestamp}')]
                if len(test_garments) < 2:
                    self.log(f"❌ Expected at least 2 test garments in system, found {len(test_garments)}")
                    return False
                
                # Store first vendor ID for later use
                self.vendor_id = test_garments[0].get('id')
            
            self.log(f"✅ Import Garments test passed! Imported {result.get('imported_garments')} garments with {len(vendor_accounts)} vendor accounts")
            return True
            
        except Exception as e:
            self.log(f"❌ Import Garments test error: {str(e)}")
            return False
    
    def test_import_production_pos(self):
        """Test 2c: Import Production POs"""
        try:
            self.log("📋 Testing Import Production POs...")
            
            if not self.vendor_id:
                self.log("❌ No vendor ID available for PO import test")
                return False
            
            # Get the actual vendor code from the created vendor
            response = requests.get(f"{API_URL}/garments", headers=self.get_headers())
            if response.status_code != 200:
                self.log("❌ Could not fetch garments for vendor code")
                return False
            
            garments = response.json()
            test_vendor = None
            for g in garments:
                if g.get('id') == self.vendor_id:
                    test_vendor = g
                    break
            
            if not test_vendor:
                self.log("❌ Could not find test vendor")
                return False
            
            vendor_code = test_vendor.get('garment_code')
            
            # Create test Excel data
            pos_data = [
                {
                    'po_number': 'TEST-PO-001',
                    'customer_name': 'Test Customer Alpha',
                    'vendor_code': vendor_code,
                    'po_date': '2025-02-01',
                    'serial_number': 'TST-SN-001',
                    'product_code': 'TEST-PRD-001',
                    'variant_sku': 'TST-S-RED',
                    'qty': 100
                },
                {
                    'po_number': 'TEST-PO-001',
                    'customer_name': 'Test Customer Alpha',
                    'vendor_code': vendor_code,
                    'po_date': '2025-02-01',
                    'serial_number': 'TST-SN-002',
                    'product_code': 'TEST-PRD-001',
                    'variant_sku': 'TST-M-RED',
                    'qty': 200
                },
                {
                    'po_number': 'TEST-PO-002',
                    'customer_name': 'Test Customer Beta',
                    'vendor_code': vendor_code,
                    'po_date': '2025-02-05',
                    'serial_number': 'TST-SN-003',
                    'product_code': 'TEST-PRD-002',
                    'variant_sku': 'TST-L-BLU',
                    'qty': 50
                }
            ]
            
            excel_data = self.create_excel_file(pos_data)
            
            # Upload file
            files = {'file': ('production_pos.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data = {'type': 'production-pos'}
            
            response = requests.post(f"{API_URL}/import-data", 
                                   headers=self.get_headers_multipart(),
                                   files=files,
                                   data=data)
            
            if response.status_code != 201:
                self.log(f"❌ Import production POs failed: {response.status_code} - {response.text}")
                return False
            
            result = response.json()
            
            # Verify results
            if result.get('imported_pos', 0) < 2:
                self.log(f"❌ Expected at least 2 POs, got {result.get('imported_pos')}")
                return False
            
            if result.get('imported_items', 0) < 3:
                self.log(f"❌ Expected at least 3 items, got {result.get('imported_items')}")
                return False
            
            # Verify POs exist in system
            response = requests.get(f"{API_URL}/production-pos", headers=self.get_headers())
            if response.status_code == 200:
                pos = response.json()
                test_pos = [p for p in pos if p.get('po_number', '').startswith('TEST-PO')]
                if len(test_pos) < 2:
                    self.log(f"❌ Expected at least 2 test POs in system, found {len(test_pos)}")
                    return False
                
                # Store first PO ID for later use
                self.po_id = test_pos[0].get('id')
            
            self.log(f"✅ Import Production POs test passed! Imported {result.get('imported_pos')} POs with {result.get('imported_items')} items")
            return True
            
        except Exception as e:
            self.log(f"❌ Import Production POs test error: {str(e)}")
            return False
    
    def test_excel_export(self):
        """Test 3: Excel Export (GET /api/export-excel)"""
        try:
            self.log("📤 Testing Excel Export...")
            
            export_types = [
                'production-pos',
                'vendor-shipments',
                'buyer-shipments',
                'report-production',
                'report-financial',
                'report-shipment',
                'invoices'
            ]
            
            for export_type in export_types:
                response = requests.get(f"{API_URL}/export-excel?type={export_type}", headers=self.get_headers())
                
                if response.status_code != 200:
                    self.log(f"❌ Export {export_type} failed: {response.status_code}")
                    return False
                
                if 'spreadsheet' not in response.headers.get('Content-Type', ''):
                    self.log(f"❌ Export {export_type} wrong content type: {response.headers.get('Content-Type')}")
                    return False
                
                if len(response.content) == 0:
                    self.log(f"❌ Export {export_type} returned empty file")
                    return False
            
            # Test invalid type should return 400
            response = requests.get(f"{API_URL}/export-excel?type=invalid", headers=self.get_headers())
            if response.status_code != 400:
                self.log(f"❌ Invalid export type should return 400, got {response.status_code}")
                return False
            
            self.log(f"✅ Excel Export test passed! All {len(export_types)} export types working")
            return True
            
        except Exception as e:
            self.log(f"❌ Excel Export test error: {str(e)}")
            return False
    
    def test_data_conflict_fix(self):
        """Test 4: Data Conflict Fix Verification"""
        try:
            self.log("🔍 Testing Data Conflict Fix...")
            
            if not self.vendor_id:
                self.log("❌ No vendor ID available for conflict test")
                return False
            
            # Create a PO with 2 items that have IDENTICAL sku, serial_number, size, color but different qty
            po_data = {
                "po_number": "CONFLICT-TEST-PO",
                "vendor_id": self.vendor_id,
                "vendor_name": "Test Vendor Alpha",
                "po_date": "2025-02-01",
                "customer_name": "Conflict Test Customer",
                "status": "Draft",
                "items": [
                    {
                        "serial_number": "SN-DUP",
                        "sku": "SKU-DUP",
                        "product_name": "Duplicate Test Item",
                        "size": "M",
                        "color": "Red",
                        "qty": 100,
                        "selling_price_snapshot": 50000,
                        "cmt_price_snapshot": 25000
                    },
                    {
                        "serial_number": "SN-DUP",
                        "sku": "SKU-DUP",
                        "product_name": "Duplicate Test Item",
                        "size": "M",
                        "color": "Red",
                        "qty": 200,
                        "selling_price_snapshot": 50000,
                        "cmt_price_snapshot": 25000
                    }
                ]
            }
            
            response = requests.post(f"{API_URL}/production-pos", 
                                   headers=self.get_headers(),
                                   json=po_data)
            
            if response.status_code != 201:
                self.log(f"❌ Conflict test PO creation failed: {response.status_code} - {response.text}")
                return False
            
            conflict_po = response.json()
            conflict_po_id = conflict_po.get('id')
            conflict_items = conflict_po.get('items', [])
            
            if len(conflict_items) != 2:
                self.log(f"❌ Expected 2 items in conflict PO response, got {len(conflict_items)}")
                return False
            
            # Create vendor shipment for the conflict PO so it appears in distribusi-kerja
            shipment_data = {
                "shipment_number": "CONFLICT-SHIPMENT",
                "vendor_id": self.vendor_id,
                "vendor_name": "Test Vendor Alpha",
                "shipment_type": "NORMAL",
                "status": "Received",
                "inspection_status": "Inspected",
                "shipment_date": "2025-02-01",
                "items": [
                    {
                        "po_id": conflict_po_id,
                        "po_number": "CONFLICT-TEST-PO",
                        "po_item_id": conflict_items[0].get('id'),
                        "product_name": "Duplicate Test Item",
                        "sku": "SKU-DUP",
                        "serial_number": "SN-DUP",
                        "size": "M",
                        "color": "Red",
                        "qty_sent": 100
                    },
                    {
                        "po_id": conflict_po_id,
                        "po_number": "CONFLICT-TEST-PO",
                        "po_item_id": conflict_items[1].get('id'),
                        "product_name": "Duplicate Test Item",
                        "sku": "SKU-DUP",
                        "serial_number": "SN-DUP",
                        "size": "M",
                        "color": "Red",
                        "qty_sent": 200
                    }
                ]
            }
            
            response = requests.post(f"{API_URL}/vendor-shipments", 
                                   headers=self.get_headers(),
                                   json=shipment_data)
            
            if response.status_code != 201:
                self.log(f"❌ Conflict test vendor shipment creation failed: {response.status_code} - {response.text}")
                return False
            
            # Verify the PO has 2 distinct items
            response = requests.get(f"{API_URL}/production-pos", headers=self.get_headers())
            if response.status_code == 200:
                pos = response.json()
                test_po = None
                for po in pos:
                    if po.get('po_number') == 'CONFLICT-TEST-PO':
                        test_po = po
                        break
                
                if not test_po:
                    self.log("❌ Conflict test PO not found")
                    return False
                
                # Check if PO has 2 items
                items = test_po.get('items', [])
                if len(items) != 2:
                    self.log(f"❌ Expected 2 items in conflict PO, got {len(items)}")
                    return False
                
                # Verify quantities are different (100 and 200)
                qtys = [item.get('qty', 0) for item in items]
                if 100 not in qtys or 200 not in qtys:
                    self.log(f"❌ Expected quantities [100, 200], got {qtys}")
                    return False
            
            # Test distribusi-kerja to verify items are NOT merged
            response = requests.get(f"{API_URL}/distribusi-kerja", headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                flat_items = data.get('flat', [])
                
                # Look for our conflict test items
                conflict_items = [item for item in flat_items if item.get('sku') == 'SKU-DUP']
                
                if len(conflict_items) != 2:
                    self.log(f"❌ Expected 2 distinct conflict items in distribusi-kerja, got {len(conflict_items)}")
                    return False
                
                # Verify both quantities are preserved separately
                conflict_qtys = [item.get('ordered_qty', 0) for item in conflict_items]
                if 100 not in conflict_qtys or 200 not in conflict_qtys:
                    self.log(f"❌ Expected conflict quantities [100, 200] in distribusi-kerja, got {conflict_qtys}")
                    return False
            
            self.log("✅ Data Conflict Fix test passed! Items with identical visible fields remain distinct")
            return True
            
        except Exception as e:
            self.log(f"❌ Data Conflict Fix test error: {str(e)}")
            return False
    
    def test_authorization(self):
        """Test 5: Authorization"""
        try:
            self.log("🔒 Testing Authorization...")
            
            # Test without token
            endpoints = [
                f"{API_URL}/import-template?type=products",
                f"{API_URL}/export-excel?type=production-pos"
            ]
            
            for endpoint in endpoints:
                response = requests.get(endpoint)
                if response.status_code != 401:
                    self.log(f"❌ Endpoint {endpoint} should return 401 without auth, got {response.status_code}")
                    return False
            
            # Test POST import-data without token
            files = {'file': ('test.xlsx', b'dummy', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data = {'type': 'products'}
            response = requests.post(f"{API_URL}/import-data", files=files, data=data)
            
            if response.status_code != 401:
                self.log(f"❌ Import-data should return 401 without auth, got {response.status_code}")
                return False
            
            self.log("✅ Authorization test passed! All endpoints properly protected")
            return True
            
        except Exception as e:
            self.log(f"❌ Authorization test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting Import/Export API Testing...")
        
        # Setup phase
        if not self.authenticate():
            return False
        
        # Testing phase
        tests = [
            ("Import Template Download", self.test_import_template_download),
            ("Import Products", self.test_import_products),
            ("Import Garments", self.test_import_garments),
            ("Import Production POs", self.test_import_production_pos),
            ("Excel Export", self.test_excel_export),
            ("Data Conflict Fix Verification", self.test_data_conflict_fix),
            ("Authorization", self.test_authorization),
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
        self.log(f"🎯 IMPORT/EXPORT TESTING COMPLETE!")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        self.log(f"{'='*60}")
        
        return failed == 0

if __name__ == "__main__":
    tester = ImportExportTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)