import http.server
import ssl
import socket
import sys

porta = 8000

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(('8.8.8.8', 80))
    ip_local = s.getsockname()[0]
except Exception:
    ip_local = '127.0.0.1'
finally:
    s.close()
    
    
caminho_cert = "C:/certs/cert.pem"
caminho_key = "C:/certs/key.pem"

httpd = http.server.HTTPServer(('0.0.0.0', porta), http.server.SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile=caminho_cert, keyfile=caminho_key)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Servidor HTTPS a correr em https://{ip_local}:{porta}")
print("Prime Ctrl+C para parar.")

httpd.serve_forever()