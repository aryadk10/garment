#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime

# Get the base URL from environment
NEXT_PUBLIC_BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pdf-auth-fix-2.preview.emergentagent.com')
BASE_URL = f"{NEXT_PUBLIC_BASE_URL}/api"

def login_as_admin():
    """Login as admin and get JWT token"""
    print("🔐 Testing admin login...")
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@garment.com",
        "password": "Admin@123"
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        user = data.get('user', {})
        print(f"✅ Admin login successful - User: {user.get('name')}, Role: {user.get('role')}")
        return token
    else:
        print(f"❌ Admin login failed: {response.status_code} - {response.text}")
        return None

def test_comprehensive_pdf_export():
    """Comprehensive test of PDF export system"""
    print("=" * 60)
    print("🔍 COMPREHENSIVE PDF Export System Testing")
    print("=" * 60)
    
    # Step 1: Login
    token = login_as_admin()
    if not token:
        return False
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Step 2: Get multiple documents of each type
    print("\n📋 Getting multiple documents for comprehensive testing...")
    
    endpoints_to_test = [
        ('production-pos', 'production-po'),
        ('vendor-shipments', 'vendor-shipment'), 
        ('buyer-shipments', 'buyer-shipment'),
        ('material-requests', 'material-request')
    ]
    
    test_results = []
    
    for endpoint, export_type in endpoints_to_test:
        print(f"\n📊 Testing {export_type} export...")
        
        # Get documents
        response = requests.get(f"{BASE_URL}/{endpoint}", headers={'Authorization': f'Bearer {token}'})
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch {endpoint}: {response.status_code}")
            continue
            
        documents = response.json()
        print(f"   Found {len(documents)} documents")
        
        if not documents:
            print(f"   ⚠️  No documents to test for {export_type}")
            continue
        
        # Test PDF export for first few documents
        test_count = min(2, len(documents))
        for i in range(test_count):
            doc = documents[i]
            doc_id = doc['id']
            doc_identifier = doc.get('po_number') or doc.get('shipment_number') or doc.get('request_number') or f"Doc-{i+1}"
            
            print(f"   🔍 Testing PDF export for {doc_identifier}...")
            
            # Make PDF export request
            pdf_url = f"{NEXT_PUBLIC_BASE_URL}/api/export-pdf"
            params = {"type": export_type, "id": doc_id}
            
            try:
                pdf_response = requests.get(pdf_url, params=params, headers=headers, timeout=30)
                
                success = False
                if pdf_response.status_code == 200:
                    content_type = pdf_response.headers.get('Content-Type', '')
                    if 'application/pdf' in content_type and pdf_response.content.startswith(b'%PDF'):
                        print(f"   ✅ PDF export successful - {len(pdf_response.content)} bytes")
                        success = True
                    else:
                        print(f"   ❌ Invalid PDF response - Content-Type: {content_type}")
                        print(f"   Content preview: {pdf_response.content[:100]}")
                else:
                    print(f"   ❌ PDF export failed: {pdf_response.status_code}")
                    try:
                        error_data = pdf_response.json()
                        print(f"   Error: {error_data.get('error', 'Unknown error')}")
                    except:
                        print(f"   Response: {pdf_response.text[:200]}")
                
                test_results.append({
                    'export_type': export_type,
                    'doc_id': doc_id,
                    'doc_identifier': doc_identifier,
                    'success': success,
                    'status_code': pdf_response.status_code,
                    'size': len(pdf_response.content) if pdf_response.status_code == 200 else 0
                })
                
            except Exception as e:
                print(f"   ❌ Exception: {str(e)}")
                test_results.append({
                    'export_type': export_type,
                    'doc_id': doc_id,
                    'doc_identifier': doc_identifier,
                    'success': False,
                    'error': str(e)
                })
    
    # Step 3: Test error cases
    print(f"\n🚨 Testing error cases...")
    
    # Test invalid type
    invalid_response = requests.get(f"{NEXT_PUBLIC_BASE_URL}/api/export-pdf", 
                                  params={"type": "invalid-type", "id": "test"}, 
                                  headers=headers)
    print(f"   Invalid type test: {invalid_response.status_code} (expected 400)")
    
    # Test invalid ID
    invalid_id_response = requests.get(f"{NEXT_PUBLIC_BASE_URL}/api/export-pdf", 
                                     params={"type": "production-po", "id": "invalid-id"}, 
                                     headers=headers)
    print(f"   Invalid ID test: {invalid_id_response.status_code} (expected 404)")
    
    # Test missing parameters
    no_params_response = requests.get(f"{NEXT_PUBLIC_BASE_URL}/api/export-pdf", headers=headers)
    print(f"   Missing params test: {no_params_response.status_code} (expected 400)")
    
    # Step 4: Summary
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE PDF Export Test Results")
    print("=" * 60)
    
    success_count = sum(1 for r in test_results if r['success'])
    total_count = len(test_results)
    
    print(f"\nSUCCESSFUL TESTS ({success_count}/{total_count}):")
    for result in test_results:
        if result['success']:
            print(f"✅ {result['export_type']} - {result['doc_identifier']} - {result['size']} bytes")
    
    if success_count < total_count:
        print(f"\nFAILED TESTS ({total_count - success_count}/{total_count}):")
        for result in test_results:
            if not result['success']:
                error_info = result.get('error', f"Status: {result.get('status_code', 'Unknown')}")
                print(f"❌ {result['export_type']} - {result['doc_identifier']} - {error_info}")
    
    # Group by type
    by_type = {}
    for result in test_results:
        export_type = result['export_type']
        if export_type not in by_type:
            by_type[export_type] = {'success': 0, 'total': 0}
        by_type[export_type]['total'] += 1
        if result['success']:
            by_type[export_type]['success'] += 1
    
    print(f"\nBY EXPORT TYPE:")
    for export_type, stats in by_type.items():
        success_rate = (stats['success'] / stats['total']) * 100 if stats['total'] > 0 else 0
        status = "✅" if stats['success'] == stats['total'] else "⚠️" if stats['success'] > 0 else "❌"
        print(f"{status} {export_type}: {stats['success']}/{stats['total']} ({success_rate:.0f}%)")
    
    overall_success = success_count == total_count
    print(f"\n🎯 OVERALL RESULT: {'✅ ALL TESTS PASSED' if overall_success else f'❌ {total_count - success_count} TESTS FAILED'}")
    
    return overall_success

if __name__ == "__main__":
    try:
        success = test_comprehensive_pdf_export()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        exit(1)