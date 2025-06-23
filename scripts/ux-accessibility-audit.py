#!/usr/bin/env python3
"""
UX and Accessibility Audit Suite for Leaker-Flow
Task 25.6 - Define & Execute UX and Accessibility Audits

This script provides comprehensive UX and accessibility testing capabilities
including automated Lighthouse audits, accessibility validation, and manual
testing guidelines following WCAG 2.1 AA standards.
"""

import json
import subprocess
import time
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import requests
from dataclasses import dataclass, asdict


@dataclass
class AuditResult:
    """Structure for audit results"""
    category: str
    score: float
    status: str
    issues: List[str]
    recommendations: List[str]
    timestamp: datetime


@dataclass
class UXMetrics:
    """UX-specific metrics"""
    task_completion_rate: float
    error_rate: float
    navigation_efficiency: float
    user_satisfaction: float
    accessibility_score: float


class UXAccessibilityAuditor:
    """Comprehensive UX and Accessibility auditing system"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.output_dir = Path("./audit-reports")
        self.output_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Admin pages to audit
        self.admin_pages = [
            "/admin", "/admin/articles", "/admin/applications", 
            "/admin/users", "/admin/settings", "/admin/analytics"
        ]
        
        # Performance targets
        self.targets = {
            "accessibility": 90, "performance": 85, 
            "best_practices": 90, "seo": 80
        }
    
    def run_lighthouse_audit(self, url: str, page_name: str) -> Dict[str, Any]:
        """Run Lighthouse audit for a specific page"""
        print(f"🔍 Auditing {page_name}...")
        
        output_file = f"{self.output_dir}/lighthouse_{page_name}_{self.timestamp}.json"
        
        cmd = [
            "npx", "lighthouse", url,
            "--chrome-flags=--headless --no-sandbox",
            "--output=json",
            f"--output-path={output_file}",
            "--form-factor=desktop"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            
            if result.returncode == 0 and os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)
                return self._parse_lighthouse_results(data, page_name)
            else:
                return {"page": page_name, "error": "Lighthouse execution failed"}
                
        except Exception as e:
            return {"page": page_name, "error": str(e)}
    
    def _parse_lighthouse_results(self, data: Dict, page_name: str) -> Dict[str, Any]:
        """Parse Lighthouse results"""
        categories = data.get('categories', {})
        audits = data.get('audits', {})
        
        results = {
            "page": page_name,
            "url": data.get('finalUrl', ''),
            "timestamp": datetime.now().isoformat(),
            "scores": {},
            "accessibility_issues": [],
            "recommendations": []
        }
        
        # Extract scores
        for category, data_cat in categories.items():
            score = data_cat.get('score', 0) * 100
            results["scores"][category] = score
            
            target = self.targets.get(category, 0)
            if score < target:
                results["recommendations"].append(
                    f"{category}: {score:.1f}% (Target: {target}%)"
                )
        
        # Extract accessibility issues
        accessibility_audits = [
            'color-contrast', 'keyboard', 'heading-order', 'alt-text'
        ]
        
        for audit_id in accessibility_audits:
            if audit_id in audits and audits[audit_id].get('score', 1) < 1:
                audit = audits[audit_id]
                results["accessibility_issues"].append({
                    "id": audit_id,
                    "title": audit.get('title', ''),
                    "score": audit.get('score', 0)
                })
        
        return results
    
    def generate_wcag_checklist(self) -> Dict[str, Any]:
        """Generate WCAG 2.1 AA compliance checklist"""
        return {
            "keyboard_navigation": {
                "description": "All interactive elements accessible via keyboard",
                "criteria": [
                    "Tab order is logical",
                    "Focus indicators visible", 
                    "Modal focus management",
                    "Keyboard shortcuts documented"
                ],
                "wcag_level": "AA",
                "status": "manual_check_required"
            },
            "color_contrast": {
                "description": "Color contrast meets WCAG standards",
                "criteria": [
                    "Normal text: 4.5:1 minimum",
                    "Large text: 3:1 minimum",
                    "UI components: 3:1 minimum"
                ],
                "wcag_level": "AA", 
                "status": "automated_check_available"
            },
            "semantic_html": {
                "description": "Proper semantic HTML structure",
                "criteria": [
                    "Headings in logical order",
                    "Proper form labels",
                    "Landmark elements used",
                    "Lists properly marked up"
                ],
                "wcag_level": "AA",
                "status": "manual_check_required"
            },
            "screen_reader": {
                "description": "Screen reader compatibility",
                "criteria": [
                    "Alt text for images",
                    "Form labels associated",
                    "Table headers identified",
                    "Content order logical"
                ],
                "wcag_level": "AA",
                "status": "requires_testing"
            }
        }
    
    def generate_ux_criteria(self) -> Dict[str, Any]:
        """Generate UX assessment criteria"""
        return {
            "navigation": {
                "description": "Navigation clarity and efficiency",
                "criteria": [
                    "Clear visual hierarchy",
                    "Consistent patterns",
                    "Breadcrumbs available",
                    "Current location indicated"
                ]
            },
            "data_presentation": {
                "description": "Data display effectiveness",
                "criteria": [
                    "Tables sortable/filterable",
                    "Loading states clear",
                    "Error messages helpful",
                    "Data density appropriate"
                ]
            },
            "interaction_design": {
                "description": "User interaction patterns",
                "criteria": [
                    "Button purposes clear",
                    "Form validation immediate",
                    "Hover states indicate action",
                    "Disabled states clear"
                ]
            }
        }
    
    def generate_report(self, lighthouse_results: List[Dict], 
                       wcag_checklist: Dict, ux_criteria: Dict) -> Dict[str, Any]:
        """Generate comprehensive audit report"""
        
        # Calculate averages
        valid_results = [r for r in lighthouse_results if 'error' not in r]
        total_pages = len(valid_results)
        
        if total_pages > 0:
            avg_accessibility = sum(r['scores'].get('accessibility', 0) 
                                  for r in valid_results) / total_pages
            avg_performance = sum(r['scores'].get('performance', 0) 
                                for r in valid_results) / total_pages
            total_issues = sum(len(r.get('accessibility_issues', [])) 
                             for r in valid_results)
        else:
            avg_accessibility = avg_performance = total_issues = 0
        
        # Determine compliance status
        if avg_accessibility >= 90 and total_issues == 0:
            compliance = "compliant"
        elif avg_accessibility >= 80:
            compliance = "mostly_compliant"
        else:
            compliance = "non_compliant"
        
        return {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "standard": "WCAG 2.1 AA",
                "pages_audited": total_pages
            },
            "summary": {
                "accessibility_score": round(avg_accessibility, 1),
                "performance_score": round(avg_performance, 1),
                "compliance_status": compliance,
                "total_issues": total_issues,
                "production_ready": compliance == "compliant"
            },
            "results": {
                "lighthouse": lighthouse_results,
                "wcag_checklist": wcag_checklist,
                "ux_criteria": ux_criteria
            },
            "recommendations": self._generate_recommendations(lighthouse_results),
            "next_steps": self._generate_next_steps(compliance)
        }
    
    def _generate_recommendations(self, lighthouse_results: List[Dict]) -> List[str]:
        """Generate prioritized recommendations"""
        recommendations = []
        for result in lighthouse_results:
            if 'recommendations' in result:
                recommendations.extend(result['recommendations'])
        
        recommendations.extend([
            "Complete manual accessibility testing",
            "Conduct user testing sessions",
            "Implement continuous monitoring"
        ])
        
        return list(set(recommendations))
    
    def _generate_next_steps(self, compliance: str) -> List[str]:
        """Generate next steps based on compliance status"""
        if compliance == "compliant":
            return [
                "Proceed with production deployment",
                "Set up accessibility monitoring",
                "Document compliance process"
            ]
        else:
            return [
                "Address critical accessibility issues",
                "Conduct manual testing",
                "Re-run automated audits"
            ]
    
    def save_report(self, report: Dict[str, Any]) -> str:
        """Save report to files"""
        # Save JSON report
        json_file = f"{self.output_dir}/ux_audit_{self.timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str, ensure_ascii=False)
        
        # Save markdown summary
        md_file = f"{self.output_dir}/audit_summary_{self.timestamp}.md"
        self._save_markdown_summary(report, md_file)
        
        return json_file
    
    def _save_markdown_summary(self, report: Dict, filename: str):
        """Save markdown summary"""
        summary = f"""# UX & Accessibility Audit Report
## {report['metadata']['timestamp']}

### Executive Summary
- **Accessibility Score**: {report['summary']['accessibility_score']}%
- **Performance Score**: {report['summary']['performance_score']}%
- **WCAG Compliance**: {report['summary']['compliance_status'].replace('_', ' ').title()}
- **Issues Found**: {report['summary']['total_issues']}
- **Production Ready**: {'✅ Yes' if report['summary']['production_ready'] else '❌ No'}

### Recommendations
"""
        for i, rec in enumerate(report['recommendations'], 1):
            summary += f"{i}. {rec}\n"
        
        summary += "\n### Next Steps\n"
        for i, step in enumerate(report['next_steps'], 1):
            summary += f"{i}. {step}\n"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(summary)
    
    def run_full_audit(self) -> Dict[str, Any]:
        """Execute complete audit"""
        print("🚀 Starting UX & Accessibility Audit...")
        print("=" * 50)
        
        # Run Lighthouse audits
        lighthouse_results = []
        for page in self.admin_pages:
            url = f"{self.base_url}{page}"
            page_name = page.replace('/', '_').strip('_') or 'home'
            result = self.run_lighthouse_audit(url, page_name)
            lighthouse_results.append(result)
            time.sleep(2)
        
        # Generate checklists
        wcag_checklist = self.generate_wcag_checklist()
        ux_criteria = self.generate_ux_criteria()
        
        # Generate report
        report = self.generate_report(lighthouse_results, wcag_checklist, ux_criteria)
        
        # Save report
        report_file = self.save_report(report)
        
        print("=" * 50)
        print(f"✅ Audit completed! Report: {report_file}")
        print(f"📊 Accessibility Score: {report['summary']['accessibility_score']}%")
        print(f"🎯 Compliance: {report['summary']['compliance_status'].replace('_', ' ').title()}")
        
        return report


def main():
    auditor = UXAccessibilityAuditor()
    return auditor.run_full_audit()


if __name__ == "__main__":
    main() 