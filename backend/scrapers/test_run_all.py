import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Ensure scrapers dir in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Pre-mock verify_links in sys.modules so import verify_links succeeds without network
mock_vl = MagicMock()
mock_vl.verify.return_value = (0, 0)
sys.modules['verify_links'] = mock_vl

import run_all

class TestRunAllOrchestrator(unittest.TestCase):
    def test_foundit_module_imported(self):
        self.assertTrue(hasattr(run_all, 'scrape_foundit'), "run_all must import scrape_foundit")

    @patch('run_all.deduplicator.deduplicate', return_value=0)
    @patch('run_all.scrape_internshala.scrape', return_value=5)
    @patch('run_all.scrape_naukri.scrape', return_value=10)
    @patch('run_all.scrape_google_jobs.scrape', return_value=15)
    @patch('run_all.scrape_foundit.scrape', return_value=20)
    @patch('requests.post')
    def test_main_runs_all_four_scrapers(self, mock_post, mock_foundit, mock_gjobs, mock_naukri, mock_internshala, mock_dedup):
        with patch('sys.exit'):
            run_all.main()
            mock_internshala.assert_called_once()
            mock_naukri.assert_called_once()
            mock_gjobs.assert_called_once()
            mock_foundit.assert_called_once()
            mock_dedup.assert_called_once()

    @patch('run_all.deduplicator.deduplicate', return_value=0)
    @patch('run_all.scrape_internshala.scrape', return_value=5)
    @patch('run_all.scrape_naukri.scrape', return_value=10)
    @patch('run_all.scrape_google_jobs.scrape', return_value=15)
    @patch('run_all.scrape_foundit.scrape', side_effect=RuntimeError("Akamai 403 Blocked"))
    @patch('requests.post')
    def test_foundit_failure_logged_loudly(self, mock_post, mock_foundit, mock_gjobs, mock_naukri, mock_internshala, mock_dedup):
        with patch('builtins.print') as mock_print:
            run_all.main()
            printed_texts = [call[0][0] for call in mock_print.call_args_list if call[0]]
            error_logged = any("::error title=Foundit Scraper Failure::" in t for t in printed_texts)
            self.assertTrue(error_logged, "Should output GitHub Actions ::error annotation on Foundit failure")

    @patch('run_all.deduplicator.deduplicate', return_value=0)
    @patch('run_all.scrape_internshala.scrape', return_value=5)
    @patch('run_all.scrape_naukri.scrape', side_effect=RuntimeError("Adzuna API Error"))
    @patch('run_all.scrape_google_jobs.scrape', return_value=15)
    @patch('run_all.scrape_foundit.scrape', return_value=20)
    @patch('requests.post')
    def test_naukri_failure_logged_loudly(self, mock_post, mock_foundit, mock_gjobs, mock_naukri, mock_internshala, mock_dedup):
        with patch('builtins.print') as mock_print:
            run_all.main()
            printed_texts = [call[0][0] for call in mock_print.call_args_list if call[0]]
            error_logged = any("::error title=Naukri Scraper Failure::" in t for t in printed_texts)
            self.assertTrue(error_logged, "Should output GitHub Actions ::error annotation on Naukri failure")

    @patch('run_all.deduplicator.deduplicate', return_value=0)
    @patch('run_all.scrape_internshala.scrape', return_value=5)
    @patch('run_all.scrape_naukri.scrape', return_value=0)
    @patch('run_all.scrape_google_jobs.scrape', return_value=15)
    @patch('run_all.scrape_foundit.scrape', return_value=20)
    @patch('requests.post')
    def test_naukri_zero_jobs_warning_logged(self, mock_post, mock_foundit, mock_gjobs, mock_naukri, mock_internshala, mock_dedup):
        with patch('builtins.print') as mock_print:
            run_all.main()
            printed_texts = [call[0][0] for call in mock_print.call_args_list if call[0]]
            warning_logged = any("::warning title=Naukri Zero Jobs::" in t for t in printed_texts)
            self.assertTrue(warning_logged, "Should output GitHub Actions ::warning annotation on Naukri zero jobs")

if __name__ == '__main__':
    unittest.main()
