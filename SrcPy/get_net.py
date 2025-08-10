from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from test import print_chunks_from_url
def get_html():
    file = open("url.txt", "r")
    url = file.read()
    file.close()
    response = requests.get(url)
    file = open("page.html", "w", encoding='utf-8')
    file.write(response.text)
    file.close()

app = Flask(__name__)
# Enable CORS for the specific Chrome extension
CORS(app, origins=["chrome-extension://cpagdbfjghnclnnjpnfkllcbcomoaeno"])  # Allow only your extension
@app.route('/process_data', methods=['POST'])
def process_data():
    data = request.get_json()  # Get data sent as JSON
    variable_from_js = data.get('theURL') # Access the variable
    
    # Process variable_from_js in Python
    file = open("url.txt", "w")
    file.write(variable_from_js)
    file.close()
    get_html()
    print_chunks_from_url("url.txt")
    processed_result = variable_from_js * 2 
    return jsonify(result=processed_result)

if __name__ == '__main__':
    app.run(debug=True)

