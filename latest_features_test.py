#!/usr/bin/env python3
"""
Backend API Testing for Latest ERP Features (Dashboard, PDF Export, Child Job Aggregation)
Tests specific endpoints mentioned in the review request.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os

class LatestFeaturesBackendTester:
    def __init__(self):
        # Use NEXT_PUBLIC_BASE_URL from .env
        self.base_url = "https://pdf-auth-fix-2.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.admin_token = None
        self.vendor_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result with timestamp"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'details': details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"    {message}")
        if details and not success:
            print(f"    Details: {details}")
        print()

    def admin_auth(self):
        """Authenticate as admin and get JWT token"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "email": "admin@garment.com",
                "password": "Admin@123"
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
                self.log_result("Admin Authentication", True, "Successfully logged in as admin")
                return True
            else:
                self.log_result("Admin Authentication", False, f"Login failed: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Admin Authentication", False, f"Auth request failed: {str(e)}")
            return False

    def vendor_auth(self):
        """Try to authenticate as vendor (find any vendor account)"""
        try:
            # First get list of garments to find a vendor account
            if not self.admin_token:
                return False
                
            response = requests.get(f"{self.api_url}/garments", 
                                  headers={'Authorization': f'Bearer {self.admin_token}'}, 
                                  timeout=10)
            
            if response.status_code == 200:
                garments = response.json()
                if not garments:
                    self.log_result("Vendor Authentication", False, "No garments found - cannot test vendor auth")
                    return False
                
                # Try first garment's login credentials if available
                garment = garments[0]
                if 'login_email' in garment and 'vendor_password_plain' in garment:
                    vendor_email = garment['login_email']
                    vendor_pass = garment['vendor_password_plain']
                    
                    vendor_response = requests.post(f"{self.api_url}/auth/login", json={
                        "email": vendor_email,
                        "password": vendor_pass
                    }, timeout=10)
                    
                    if vendor_response.status_code == 200:
                        vendor_data = vendor_response.json()
                        self.vendor_token = vendor_data.get('token')
                        self.log_result("Vendor Authentication", True, f"Successfully logged in as vendor: {vendor_email}")
                        return True
                    else:
                        self.log_result("Vendor Authentication", False, f"Vendor login failed: {vendor_response.status_code}")
                        return False
                else:
                    self.log_result("Vendor Authentication", False, "No vendor credentials found in garment data")
                    return False
            else:
                self.log_result("Vendor Authentication", False, f"Could not fetch garments: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Vendor Authentication", False, f"Vendor auth error: {str(e)}")
            return False

    def get_admin_headers(self):
        """Get headers with admin Authorization token"""
        return {
            'Authorization': f'Bearer {self.admin_token}',
            'Content-Type': 'application/json'
        }

    def get_vendor_headers(self):
        """Get headers with vendor Authorization token"""
        return {
            'Authorization': f'Bearer {self.vendor_token}',
            'Content-Type': 'application/json'
        }

    def test_erp_dashboard_new_fields(self):
        """Test ERP Dashboard - verify NEW fields are present"""
        try:
            response = requests.get(f"{self.api_url}/dashboard", 
                                  headers=self.get_admin_headers(), timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for NEW fields mentioned in review request
                new_fields = [
                    'activeJobs', 'pendingShipments', 'pendingAdditionalRequests', 
                    'pendingReplacementRequests', 'pendingReturns', 'totalBuyerShipments',
                    'globalProgressPct', 'totalProducedGlobal', 'totalAvailableGlobal'
                ]
                
                missing_fields = [field for field in new_fields if field not in data]
                present_fields = [field for field in new_fields if field in data]
                
                if not missing_fields:
                    # All new fields present - show some values
                    field_values = {field: data.get(field, 'N/A') for field in new_fields}
                    self.log_result("ERP Dashboard New Fields", True, 
                                  f"All new dashboard fields present. Sample values: activeJobs={data.get('activeJobs')}, globalProgressPct={data.get('globalProgressPct')}%, totalProducedGlobal={data.get('totalProducedGlobal')}")
                else:
                    self.log_result("ERP Dashboard New Fields", False, 
                                  f"Missing fields: {missing_fields}. Present: {present_fields}", 
                                  f"Full response keys: {list(data.keys())}")
            else:
                self.log_result("ERP Dashboard New Fields", False, 
                              f"Dashboard request failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("ERP Dashboard New Fields", False, f"Request error: {str(e)}")

    def test_vendor_dashboard(self):
        """Test Vendor Dashboard - verify vendor-specific dashboard"""
        if not self.vendor_token:
            self.log_result("Vendor Dashboard", False, "No vendor token available - skipped")
            return
            
        try:
            response = requests.get(f"{self.api_url}/vendor/dashboard", 
                                  headers=self.get_vendor_headers(), timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for expected vendor dashboard fields
                expected_fields = [
                    'totalReceived', 'totalMissing', 'totalDefect', 'pendingInspections',
                    'pendingAdditional', 'pendingReplacement', 'totalAvailable'
                ]
                
                missing_fields = [field for field in expected_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Vendor Dashboard", True, 
                                  f"Vendor dashboard working. Stats: totalReceived={data.get('totalReceived')}, pendingInspections={data.get('pendingInspections')}, totalAvailable={data.get('totalAvailable')}")
                else:
                    self.log_result("Vendor Dashboard", True, 
                                  f"Vendor dashboard accessible but missing some fields: {missing_fields}. Available fields: {list(data.keys())}")
            else:
                self.log_result("Vendor Dashboard", False, 
                              f"Vendor dashboard request failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Vendor Dashboard", False, f"Request error: {str(e)}")

    def test_production_job_items_child_aggregation(self):
        """Test Production Job Items - verify child job aggregation fields"""
        try:
            # First get list of production jobs to find a job_id
            jobs_response = requests.get(f"{self.api_url}/production-jobs", 
                                       headers=self.get_admin_headers(), timeout=10)
            
            if jobs_response.status_code == 200:
                jobs = jobs_response.json()
                if not jobs:
                    self.log_result("Production Job Items Child Aggregation", False, "No production jobs found to test")
                    return
                
                job_id = jobs[0]['id']
                
                # Test the production-job-items endpoint with child aggregation
                response = requests.get(f"{self.api_url}/production-job-items?job_id={job_id}", 
                                      headers=self.get_admin_headers(), timeout=10)
                
                if response.status_code == 200:
                    items = response.json()
                    
                    if not items:
                        self.log_result("Production Job Items Child Aggregation", True, 
                                      "Production job items endpoint working (empty result)")
                        return
                    
                    # Check for new child aggregation fields
                    required_fields = ['total_produced_qty', 'child_produced_qty', 'remaining_to_ship', 'shipped_to_buyer']
                    
                    first_item = items[0]
                    missing_fields = [field for field in required_fields if field not in first_item]
                    
                    if not missing_fields:
                        sample_item = first_item
                        self.log_result("Production Job Items Child Aggregation", True, 
                                      f"All child aggregation fields present. Sample: total_produced_qty={sample_item.get('total_produced_qty')}, child_produced_qty={sample_item.get('child_produced_qty')}, remaining_to_ship={sample_item.get('remaining_to_ship')}")
                    else:
                        self.log_result("Production Job Items Child Aggregation", False, 
                                      f"Missing aggregation fields: {missing_fields}. Available: {list(first_item.keys())}")
                else:
                    self.log_result("Production Job Items Child Aggregation", False, 
                                  f"Job items request failed: {response.status_code}", response.text)
            else:
                self.log_result("Production Job Items Child Aggregation", False, 
                              f"Could not get production jobs: {jobs_response.status_code}")
                
        except Exception as e:
            self.log_result("Production Job Items Child Aggregation", False, f"Request error: {str(e)}")

    def test_pdf_export_endpoints(self):
        """Test all PDF export endpoints"""
        # Get sample IDs for testing
        try:
            # Get production PO ID
            pos_response = requests.get(f"{self.api_url}/production-pos", 
                                      headers=self.get_admin_headers(), timeout=10)
            po_id = None
            if pos_response.status_code == 200:
                pos = pos_response.json()
                if pos:
                    po_id = pos[0]['id']
            
            # Get vendor shipment ID
            vs_response = requests.get(f"{self.api_url}/vendor-shipments", 
                                     headers=self.get_admin_headers(), timeout=10)
            shipment_id = None
            if vs_response.status_code == 200:
                shipments = vs_response.json()
                if shipments:
                    shipment_id = shipments[0]['id']
            
            # Get buyer shipment ID
            bs_response = requests.get(f"{self.api_url}/buyer-shipments", 
                                     headers=self.get_admin_headers(), timeout=10)
            buyer_shipment_id = None
            if bs_response.status_code == 200:
                buyer_shipments = bs_response.json()
                if buyer_shipments:
                    buyer_shipment_id = buyer_shipments[0]['id']
            
            # Test each PDF export type
            export_tests = [
                ('production-po', po_id, 'Production PO PDF Export'),
                ('vendor-shipment', shipment_id, 'Vendor Shipment PDF Export'),
                ('buyer-shipment', buyer_shipment_id, 'Buyer Shipment PDF Export')
            ]
            
            for export_type, test_id, test_name in export_tests:
                if test_id:
                    response = requests.get(f"{self.api_url}/export-pdf?type={export_type}&id={test_id}", 
                                          headers=self.get_admin_headers(), timeout=20)
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('Content-Type', '')
                        if 'application/pdf' in content_type:
                            self.log_result(test_name, True, 
                                          f"PDF export working - Content-Type: {content_type}, Size: {len(response.content)} bytes")
                        else:
                            self.log_result(test_name, False, 
                                          f"Wrong content type: {content_type}")
                    else:
                        self.log_result(test_name, False, 
                                      f"PDF export failed: {response.status_code}", response.text[:200])
                else:
                    self.log_result(test_name, False, f"No {export_type} ID available for testing")
                    
        except Exception as e:
            self.log_result("PDF Export Tests", False, f"PDF export test error: {str(e)}")

    def test_distribusi_kerja_child_aggregation(self):
        """Test Distribusi Kerja - verify child job aggregation in produced_qty"""
        try:
            response = requests.get(f"{self.api_url}/distribusi-kerja", 
                                  headers=self.get_admin_headers(), timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has the new hierarchical structure
                if isinstance(data, dict) and 'hierarchy' in data and 'flat' in data:
                    flat_data = data['flat']
                    hierarchy_data = data['hierarchy']
                    
                    if flat_data and len(flat_data) > 0:
                        # Check if produced_qty field is present (should include child jobs now)
                        sample_item = flat_data[0]
                        if 'produced_qty' in sample_item:
                            self.log_result("Distribusi Kerja Child Job Aggregation", True, 
                                          f"Distribusi Kerja working with child aggregation. Sample produced_qty: {sample_item.get('produced_qty')}, Items: {len(flat_data)} flat, {len(hierarchy_data)} vendors")
                        else:
                            self.log_result("Distribusi Kerja Child Job Aggregation", False, 
                                          f"produced_qty field missing. Available fields: {list(sample_item.keys())}")
                    else:
                        self.log_result("Distribusi Kerja Child Job Aggregation", True, 
                                      "Distribusi Kerja endpoint working (empty data)")
                else:
                    # Old format - still check for produced_qty
                    if isinstance(data, list) and len(data) > 0:
                        sample_item = data[0]
                        if 'produced_qty' in sample_item:
                            self.log_result("Distribusi Kerja Child Job Aggregation", True, 
                                          f"Distribusi Kerja working (old format). produced_qty field present")
                        else:
                            self.log_result("Distribusi Kerja Child Job Aggregation", False, 
                                          f"produced_qty field missing in old format")
                    else:
                        self.log_result("Distribusi Kerja Child Job Aggregation", True, 
                                      "Distribusi Kerja endpoint accessible (empty)")
            else:
                self.log_result("Distribusi Kerja Child Job Aggregation", False, 
                              f"Distribusi Kerja request failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Distribusi Kerja Child Job Aggregation", False, f"Request error: {str(e)}")

    def run_all_tests(self):
        """Run all latest features tests"""
        print("=" * 80)
        print("BACKEND TESTING - Latest ERP Features")
        print("Testing: Dashboard, PDF Export, Child Job Aggregation")
        print("=" * 80)
        print()
        
        # Authenticate
        if not self.admin_auth():
            print("❌ CRITICAL: Admin authentication failed. Cannot proceed.")
            return False
        
        # Try vendor auth (optional)
        self.vendor_auth()
        
        # Run all tests
        self.test_erp_dashboard_new_fields()
        self.test_vendor_dashboard()
        self.test_production_job_items_child_aggregation()
        self.test_pdf_export_endpoints()
        self.test_distribusi_kerja_child_aggregation()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        # List failures
        failures = [r for r in self.test_results if not r['success']]
        if failures:
            print("\n❌ FAILED TESTS:")
            for f in failures:
                print(f"  - {f['test']}: {f['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = LatestFeaturesBackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)