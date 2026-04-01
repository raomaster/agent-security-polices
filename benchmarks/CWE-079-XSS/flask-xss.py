from flask import Flask, request, make_response

app = Flask(__name__)


@app.route('/greet')
def greet():
    name = request.args.get('name', 'World')
    response = make_response(f"<h1>Hello {name}</h1>")
    response.headers['Content-Type'] = 'text/html'
    return response


@app.route('/profile')
def profile():
    username = request.args.get('user', '')
    bio = request.args.get('bio', '')
    html = f"""
    <html>
      <body>
        <h2>{username}</h2>
        <p>{bio}</p>
      </body>
    </html>
    """
    return make_response(html)


if __name__ == '__main__':
    app.run(debug=False)
