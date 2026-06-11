import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import gzip
import json
import shutil

PORT = 8000
TARGET_HOST = "https://api.douyin.wtf"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/download"):
            self.handle_local_download()
        elif self.path.startswith("/api/"):
            self.proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy_request("POST")
        else:
            self.send_error(404, "File not found")

    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def proxy_request(self, method):
        target_url = TARGET_HOST + self.path
        print(f"Proxying {method}: {self.path} -> {target_url}", flush=True)
        
        # Read request body for POST requests
        data = None
        if method == "POST":
            content_length = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(content_length)
            
        req_headers = {}
        for key in self.headers:
            if key.lower() not in ('host', 'origin', 'referer', 'content-length', 'accept-encoding'):
                req_headers[key] = self.headers[key]
                
        req = urllib.request.Request(target_url, data=data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read()
                
                # Decompress if gzipped
                content_encoding = response.getheader('Content-Encoding')
                if content_encoding == 'gzip':
                    try:
                        body = gzip.decompress(body)
                    except Exception as dec_err:
                        print(f"Failed to decompress gzip response: {dec_err}", flush=True)
                
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in ('content-encoding', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'content-length'):
                        self.send_header(key, value)
                
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
                
        except urllib.error.HTTPError as e:
            body = e.read()
            content_encoding = e.headers.get('Content-Encoding')
            if content_encoding == 'gzip':
                try:
                    body = gzip.decompress(body)
                except Exception as dec_err:
                    print(f"Failed to decompress gzip error response: {dec_err}", flush=True)
                    
            self.send_response(e.code)
            for key, value in e.headers.items():
                if key.lower() not in ('content-encoding', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'content-length'):
                    self.send_header(key, value)
                    
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            
        except Exception as e:
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

    def handle_local_download(self):
        # Parse query parameters
        parsed_url = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed_url.query)
        video_url_list = params.get('url')
        with_watermark_list = params.get('with_watermark', ['false'])
        
        if not video_url_list:
            self.send_error_response(400, "Missing 'url' parameter.")
            return
            
        video_url = video_url_list[0]
        with_watermark = with_watermark_list[0].lower() == 'true'
        print(f"Local download handler triggered for: {video_url} (watermark={with_watermark})", flush=True)
        
        # 1. Fetch metadata from the remote API parser (since it works!)
        parser_url = f"{TARGET_HOST}/api/hybrid/video_data?url={urllib.parse.quote(video_url)}&minimal=true"
        req = urllib.request.Request(parser_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read()
                if response.getheader('Content-Encoding') == 'gzip':
                    body = gzip.decompress(body)
                meta_json = json.loads(body.decode('utf-8'))
        except Exception as e:
            self.send_error_response(500, f"Failed to retrieve video metadata from API: {e}")
            return
            
        if meta_json.get('code') != 200 or not meta_json.get('data'):
            msg = meta_json.get('message') or "Error parsing video."
            self.send_error_response(400, f"API Parser Error: {msg}")
            return
            
        data = meta_json['data']
        data_type = data.get('type')
        platform = data.get('platform')
        video_id = data.get('video_id')
        
        if data_type != 'video':
            self.send_error_response(400, f"Data type '{data_type}' is not supported by the local download proxy (only videos are supported).")
            return
            
        video_data = data.get('video_data', {})
        # Fallback quality URL resolution
        if not with_watermark:
            download_url = video_data.get('nwm_video_url_HQ') or video_data.get('nwm_video_url') or video_data.get('wm_video_url')
        else:
            download_url = video_data.get('wm_video_url_HQ') or video_data.get('wm_video_url')
            
        if not download_url:
            self.send_error_response(400, "Could not find a valid play/download URL in the metadata.")
            return
            
        filename = f"douyin_{video_id}.mp4" if platform == 'douyin' else f"{platform}_{video_id}.mp4"
        print(f"Proxy streaming video file from CDN: {download_url}", flush=True)
        
        # 2. Stream download back to client
        try:
            # Prepare CDN request with browser headers (required to bypass CDN blocks)
            cdn_req = urllib.request.Request(download_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.douyin.com/'
            })
            with urllib.request.urlopen(cdn_req, timeout=30) as cdn_response:
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Disposition", f"attachment; filename={filename}")
                self.send_header("Access-Control-Allow-Origin", "*")
                
                content_length = cdn_response.getheader('Content-Length')
                if content_length:
                    self.send_header("Content-Length", content_length)
                self.end_headers()
                
                # Stream the file directly
                shutil.copyfileobj(cdn_response, self.wfile)
                print(f"Successfully downloaded and streamed {filename} to client.", flush=True)
        except Exception as e:
            print(f"Error streaming video from CDN: {e}", flush=True)
            try:
                self.send_error_response(500, f"Error streaming video from CDN: {e}")
            except:
                pass

    def send_error_response(self, code, message):
        try:
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            err_json = {"code": code, "message": message}
            self.wfile.write(json.dumps(err_json).encode('utf-8'))
        except:
            pass

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"Dev server with API proxy running at http://localhost:{PORT}", flush=True)
        print(f"Proxy target: {TARGET_HOST}", flush=True)
        httpd.serve_forever()
