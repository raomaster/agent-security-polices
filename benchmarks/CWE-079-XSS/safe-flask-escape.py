from flask import Flask, request, make_response
from markupsafe import escape

app = Flask(__name__)


@app.route('/greet')
def greet():
    name = request.args.get('name', 'World')
    safe_name = escape(name)
    response = make_response(f"<h1>Hello {safe_name}</h1>")
    response.headers['Content-Type'] = 'text/html'
    return response


@app.route('/profile')
def profile():
    username = request.args.get('user', '')
    bio = request.args.get('bio', '')
    safe_username = escape(username)
    safe_bio = escape(bio)
    html = f"""
    <html>
      <body>
        <h2>{safe_username}</h2>
        <p>{safe_bio}</p>
      </body>
    </html>
    """
    return make_response(html)


if __name__ == '__main__':
    app.run(debug=False)
