#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Garment ERP System
Testing all backend API endpoints as specified in review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://pdf-auth-fix-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@garment.com"
ADMIN_PASSWORD = "Admin@123"

class ComprehensiveGarmentERPTester:
    def __init__(self):
        self.token = None
        self.session = requests.Session()
        self.test_results = []
        self.created_invoice_id = None
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def authenticate(self):
        """Step 1: Authenticate and get JWT token"""
        print("\n=== 1. AUTHENTICATION TEST ===")
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data:
                    self.token = data['token']
                    self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                    self.log_result("Authentication", True, f"Login successful with {ADMIN_EMAIL}")
                    return True
                else:
                    self.log_result("Authentication", False, f"No token in response: {data}")
                    return False
            else:
                self.log_result("Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Exception during login: {str(e)}")
            return False
    
    def test_dashboard_with_adjustments(self):
        """Test 2: Dashboard with Adjustments"""
        print("\n=== 2. DASHBOARD WITH ADJUSTMENTS ===")
        try:
            response = self.session.get(f"{API_BASE}/dashboard")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['totalPOs', 'activeJobs', 'globalProgressPct', 'totalInvoiced', 'outstanding', 'grossMargin']
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_result("Dashboard Fields", False, f"Missing fields: {missing_fields}")
                    return False
                else:
                    self.log_result("Dashboard Fields", True, f"All required fields present")
                    
                # Check specific values
                self.log_result("Dashboard Data", True, 
                    f"totalPOs: {data.get('totalPOs')}, activeJobs: {data.get('activeJobs')}, "
                    f"globalProgressPct: {data.get('globalProgressPct')}%, grossMargin: {data.get('grossMargin')}")
                return True
            else:
                self.log_result("Dashboard", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Dashboard", False, f"Exception: {str(e)}")
            return False
    
    def test_production_monitoring_v2(self):
        """Test 3: Production Monitoring V2"""
        print("\n=== 3. PRODUCTION MONITORING V2 ===")
        try:
            response = self.session.get(f"{API_BASE}/production-monitoring-v2")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Production Monitoring V2", True, f"Returned array with {len(data)} vendors")
                    
                    # Check structure if data exists
                    if len(data) > 0:
                        vendor = data[0]
                        required_fields = ['vendor_name', 'total_qty', 'total_produced', 'total_shipped', 'progress_pct', 'jobs']
                        missing_fields = [field for field in required_fields if field not in vendor]
                        
                        if missing_fields:
                            self.log_result("Production Monitoring V2 Structure", False, f"Missing fields: {missing_fields}")
                        else:
                            self.log_result("Production Monitoring V2 Structure", True, "All required fields present")
                            
                            # Check jobs array structure
                            if 'jobs' in vendor and len(vendor['jobs']) > 0:
                                job = vendor['jobs'][0]
                                job_required_fields = ['serial_numbers', 'child_job_count']
                                job_missing_fields = [field for field in job_required_fields if field not in job]
                                
                                if job_missing_fields:
                                    self.log_result("Production Monitoring V2 Jobs", False, f"Missing job fields: {job_missing_fields}")
                                else:
                                    self.log_result("Production Monitoring V2 Jobs", True, "Jobs have required fields (serial_numbers, child_job_count)")
                    return True
                else:
                    self.log_result("Production Monitoring V2", False, f"Expected array, got: {type(data)}")
                    return False
            else:
                self.log_result("Production Monitoring V2", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Production Monitoring V2", False, f"Exception: {str(e)}")
            return False
    
    def test_production_pos_with_serial_numbers(self):
        """Test 4: Production POs with Serial Numbers"""
        print("\n=== 4. PRODUCTION POS WITH SERIAL NUMBERS ===")
        try:
            response = self.session.get(f"{API_BASE}/production-pos")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Production POs", True, f"Returned array with {len(data)} POs")
                    
                    # Check structure if data exists
                    if len(data) > 0:
                        po = data[0]
                        required_fields = ['serial_numbers', 'composite_label']
                        missing_fields = [field for field in required_fields if field not in po]
                        
                        if missing_fields:
                            self.log_result("Production POs Structure", False, f"Missing fields: {missing_fields}")
                        else:
                            self.log_result("Production POs Structure", True, 
                                f"PO has serial_numbers (array) and composite_label fields")
                    return True
                else:
                    self.log_result("Production POs", False, f"Expected array, got: {type(data)}")
                    return False
            else:
                self.log_result("Production POs", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Production POs", False, f"Exception: {str(e)}")
            return False
    
    def test_vendor_shipments_with_children(self):
        """Test 5: Vendor Shipments with Children"""
        print("\n=== 5. VENDOR SHIPMENTS WITH CHILDREN ===")
        try:
            # Get vendor shipments list
            response = self.session.get(f"{API_BASE}/vendor-shipments")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Vendor Shipments List", True, f"Returned array with {len(data)} shipments")
                    
                    # Check structure if data exists
                    if len(data) > 0:
                        shipment = data[0]
                        required_fields = ['child_shipment_count', 'has_children']
                        missing_fields = [field for field in required_fields if field not in shipment]
                        
                        if missing_fields:
                            self.log_result("Vendor Shipments Structure", False, f"Missing fields: {missing_fields}")
                        else:
                            self.log_result("Vendor Shipments Structure", True, 
                                f"Shipments have child_shipment_count and has_children fields")
                        
                        # Test detail endpoint for first shipment
                        shipment_id = shipment.get('id')
                        if shipment_id:
                            detail_response = self.session.get(f"{API_BASE}/vendor-shipments/{shipment_id}")
                            
                            if detail_response.status_code == 200:
                                detail_data = detail_response.json()
                                if 'child_shipments' in detail_data:
                                    self.log_result("Vendor Shipment Detail", True, 
                                        f"Detail includes child_shipments array with {len(detail_data['child_shipments'])} children")
                                else:
                                    self.log_result("Vendor Shipment Detail", False, "Detail missing child_shipments array")
                            else:
                                self.log_result("Vendor Shipment Detail", False, f"Detail HTTP {detail_response.status_code}")
                    return True
                else:
                    self.log_result("Vendor Shipments", False, f"Expected array, got: {type(data)}")
                    return False
            else:
                self.log_result("Vendor Shipments", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Vendor Shipments", False, f"Exception: {str(e)}")
            return False
    
    def test_financial_recap_with_adjustments(self):
        """Test 6: Financial Recap with Adjustments"""
        print("\n=== 6. FINANCIAL RECAP WITH ADJUSTMENTS ===")
        try:
            response = self.session.get(f"{API_BASE}/financial-recap")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_sales_value', 'total_vendor_cost', 'gross_margin', 'total_adjustments']
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_result("Financial Recap Fields", False, f"Missing fields: {missing_fields}")
                    return False
                else:
                    self.log_result("Financial Recap Fields", True, "All required fields present")
                    
                # Check specific values
                self.log_result("Financial Recap Data", True, 
                    f"total_sales_value: {data.get('total_sales_value')}, "
                    f"total_vendor_cost: {data.get('total_vendor_cost')}, "
                    f"gross_margin: {data.get('gross_margin')}, "
                    f"total_adjustments: {data.get('total_adjustments')}")
                return True
            else:
                self.log_result("Financial Recap", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Financial Recap", False, f"Exception: {str(e)}")
            return False
    
    def test_invoice_adjustment_full_lifecycle(self):
        """Test 7: Invoice Adjustment Full Lifecycle"""
        print("\n=== 7. INVOICE ADJUSTMENT FULL LIFECYCLE ===")
        
        # First, get or create an invoice
        invoice_id = self.get_or_create_test_invoice()
        if not invoice_id:
            return False
        
        try:
            # Get initial invoice state
            initial_response = self.session.get(f"{API_BASE}/invoices/{invoice_id}")
            if initial_response.status_code != 200:
                self.log_result("Invoice Initial State", False, f"Could not get invoice: {initial_response.status_code}")
                return False
            
            initial_data = initial_response.json()
            base_amount = initial_data.get('total_amount', 500000)  # Use total_amount if available
            
            # Create ADD adjustment
            add_adjustment_data = {
                "invoice_id": invoice_id,
                "adjustment_type": "ADD",
                "amount": 100000,
                "reason": "Tambahan barang"
            }
            
            response = self.session.post(f"{API_BASE}/invoice-adjustments", json=add_adjustment_data)
            
            if response.status_code == 201:
                self.log_result("Invoice Adjustment ADD", True, "ADD adjustment created successfully")
            else:
                self.log_result("Invoice Adjustment ADD", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Create DEDUCT adjustment
            deduct_adjustment_data = {
                "invoice_id": invoice_id,
                "adjustment_type": "DEDUCT",
                "amount": 30000,
                "reason": "Potongan defect"
            }
            
            response = self.session.post(f"{API_BASE}/invoice-adjustments", json=deduct_adjustment_data)
            
            if response.status_code == 201:
                self.log_result("Invoice Adjustment DEDUCT", True, "DEDUCT adjustment created successfully")
            else:
                self.log_result("Invoice Adjustment DEDUCT", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Verify invoice adjusted total
            response = self.session.get(f"{API_BASE}/invoices/{invoice_id}")
            
            if response.status_code == 200:
                invoice_data = response.json()
                adjusted_total = invoice_data.get('adjusted_total')
                adjustments = invoice_data.get('adjustments', [])
                
                expected_total = base_amount + 100000 - 30000
                
                if adjusted_total == expected_total:
                    self.log_result("Invoice Adjusted Total", True, 
                        f"Adjusted total correct: {base_amount} + 100000 - 30000 = {adjusted_total}")
                else:
                    self.log_result("Invoice Adjusted Total", False, 
                        f"Expected {expected_total}, got {adjusted_total}")
                
                if len(adjustments) == 2:
                    self.log_result("Invoice Adjustments Array", True, "Invoice has 2 adjustments in array")
                else:
                    self.log_result("Invoice Adjustments Array", False, f"Expected 2 adjustments, got {len(adjustments)}")
                
                return True
            else:
                self.log_result("Invoice Verification", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
        except Exception as e:
            self.log_result("Invoice Adjustment Lifecycle", False, f"Exception: {str(e)}")
            return False
    
    def get_or_create_test_invoice(self):
        """Helper: Get existing invoice or create test invoice"""
        try:
            # First try to get existing invoices
            response = self.session.get(f"{API_BASE}/invoices")
            if response.status_code == 200:
                invoices = response.json()
                if len(invoices) > 0:
                    invoice_id = invoices[0]['id']
                    self.log_result("Test Invoice", True, f"Using existing invoice: {invoice_id}")
                    return invoice_id
            
            # Create a test invoice
            test_invoice = {
                "invoice_number": f"INV-TEST-PH2-{int(datetime.now().timestamp())}",
                "invoice_type": "Standard",
                "invoice_category": "VENDOR",
                "total_amount": 500000,
                "vendor_or_customer_name": "Test Vendor Phase2",
                "status": "Unpaid",
                "invoice_items": []
            }
            
            response = self.session.post(f"{API_BASE}/invoices", json=test_invoice)
            if response.status_code == 201:
                invoice_data = response.json()
                invoice_id = invoice_data.get('id')
                self.created_invoice_id = invoice_id
                self.log_result("Test Invoice Creation", True, f"Created test invoice: {invoice_id}")
                return invoice_id
            else:
                self.log_result("Test Invoice Creation", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Test Invoice Creation", False, f"Exception: {str(e)}")
            return None
    
    def test_company_settings(self):
        """Test 8: Company Settings"""
        print("\n=== 8. COMPANY SETTINGS ===")
        try:
            # Test POST - Create/Update settings
            test_data = {
                "company_name": "PT Test Garment Phase2",
                "company_address": "Jl Test",
                "pdf_header_line1": "Test Header"
            }
            
            response = self.session.post(f"{API_BASE}/company-settings", json=test_data)
            
            if response.status_code == 200:
                self.log_result("Company Settings POST", True, "Settings updated successfully")
            else:
                self.log_result("Company Settings POST", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test GET - Verify data saved
            response = self.session.get(f"{API_BASE}/company-settings")
            
            if response.status_code == 200:
                data = response.json()
                if (data.get('company_name') == test_data['company_name'] and 
                    data.get('company_address') == test_data['company_address'] and
                    data.get('pdf_header_line1') == test_data['pdf_header_line1']):
                    self.log_result("Company Settings GET", True, "Data saved and retrieved correctly")
                    return True
                else:
                    self.log_result("Company Settings GET", False, "Data not saved correctly")
                    return False
            else:
                self.log_result("Company Settings GET", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Company Settings", False, f"Exception: {str(e)}")
            return False
    
    def test_all_report_types(self):
        """Test 9: All Report Types"""
        print("\n=== 9. ALL REPORT TYPES ===")
        
        report_types = [
            'production', 'progress', 'financial', 'shipment', 
            'return', 'missing-material', 'replacement'
        ]
        
        for report_type in report_types:
            try:
                response = self.session.get(f"{API_BASE}/reports/{report_type}")
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        self.log_result(f"Report {report_type.title()}", True, f"Returned array with {len(data)} items")
                        
                        # Special check for financial report
                        if report_type == 'financial' and len(data) > 0:
                            sample = data[0]
                            if 'adjustment_add' in sample and 'adjustment_deduct' in sample:
                                self.log_result(f"Report {report_type.title()} Adjustments", True, 
                                    "Financial report includes adjustment fields")
                            else:
                                self.log_result(f"Report {report_type.title()} Adjustments", False, 
                                    "Financial report missing adjustment fields")
                    else:
                        self.log_result(f"Report {report_type.title()}", False, f"Expected array, got: {type(data)}")
                else:
                    self.log_result(f"Report {report_type.title()}", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result(f"Report {report_type.title()}", False, f"Exception: {str(e)}")
    
    def test_pdf_export_with_company_settings(self):
        """Test 10: PDF Export with Company Settings"""
        print("\n=== 10. PDF EXPORT WITH COMPANY SETTINGS ===")
        
        # First get a PO ID for testing
        try:
            response = self.session.get(f"{API_BASE}/production-pos")
            if response.status_code == 200:
                pos = response.json()
                if len(pos) > 0:
                    po_id = pos[0]['id']
                    
                    # Test PDF export
                    pdf_response = self.session.get(f"{API_BASE}/export-pdf?type=production-po&id={po_id}")
                    
                    if pdf_response.status_code == 200:
                        content_type = pdf_response.headers.get('content-type', '')
                        if 'application/pdf' in content_type:
                            self.log_result("PDF Export", True, f"PDF generated successfully for PO {po_id}")
                            return True
                        else:
                            self.log_result("PDF Export", False, f"Wrong content type: {content_type}")
                            return False
                    else:
                        self.log_result("PDF Export", False, f"HTTP {pdf_response.status_code}: {pdf_response.text}")
                        return False
                else:
                    self.log_result("PDF Export", False, "No POs available for testing")
                    return False
            else:
                self.log_result("PDF Export", False, f"Could not get POs: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("PDF Export", False, f"Exception: {str(e)}")
            return False
    
    def test_validation(self):
        """Test 11: Validation"""
        print("\n=== 11. VALIDATION TESTS ===")
        
        # Test 1: Missing invoice_id
        try:
            response = self.session.post(f"{API_BASE}/invoice-adjustments", json={
                "adjustment_type": "ADD",
                "amount": 50000,
                "reason": "Test"
            })
            
            if response.status_code == 400:
                self.log_result("Validation - Missing invoice_id", True, "Correctly rejected missing invoice_id")
            else:
                self.log_result("Validation - Missing invoice_id", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Validation - Missing invoice_id", False, f"Exception: {str(e)}")
        
        # Test 2: Invalid adjustment_type
        try:
            response = self.session.post(f"{API_BASE}/invoice-adjustments", json={
                "invoice_id": "test-id",
                "adjustment_type": "INVALID",
                "amount": 50000,
                "reason": "Test"
            })
            
            if response.status_code == 400:
                self.log_result("Validation - Invalid adjustment_type", True, "Correctly rejected invalid adjustment_type")
            else:
                self.log_result("Validation - Invalid adjustment_type", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Validation - Invalid adjustment_type", False, f"Exception: {str(e)}")
        
        # Test 3: Amount 0
        try:
            response = self.session.post(f"{API_BASE}/invoice-adjustments", json={
                "invoice_id": "test-id",
                "adjustment_type": "ADD",
                "amount": 0,
                "reason": "Test"
            })
            
            if response.status_code == 400:
                self.log_result("Validation - Amount 0", True, "Correctly rejected amount 0")
            else:
                self.log_result("Validation - Amount 0", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Validation - Amount 0", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive Garment ERP Backend API Testing")
        print(f"Testing against: {BASE_URL}")
        print("=" * 80)
        
        # Authentication is required for all tests
        if not self.authenticate():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with other tests")
            return False
        
        # Run all tests in order
        test_methods = [
            self.test_dashboard_with_adjustments,
            self.test_production_monitoring_v2,
            self.test_production_pos_with_serial_numbers,
            self.test_vendor_shipments_with_children,
            self.test_financial_recap_with_adjustments,
            self.test_invoice_adjustment_full_lifecycle,
            self.test_company_settings,
            self.test_all_report_types,
            self.test_pdf_export_with_company_settings,
            self.test_validation
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ CRITICAL ERROR in {test_method.__name__}: {str(e)}")
        
        # Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for result in failed_tests:
                print(f"  • {result['test']}: {result['message']}")
        
        # List passed tests
        passed_tests = [result for result in self.test_results if result['success']]
        if passed_tests:
            print(f"\n✅ PASSED TESTS ({len(passed_tests)}):")
            for result in passed_tests:
                print(f"  • {result['test']}: {result['message']}")

if __name__ == "__main__":
    tester = ComprehensiveGarmentERPTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)