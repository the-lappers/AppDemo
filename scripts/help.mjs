console.log(`Day-Off demo commands

  make env            create .env from .env.example, then put your map keys in it
  make start          run the demo at http://localhost:4173  (PORT=5000 make start for another port)
  make places-template  write data/places.example.json (the place data format)
  make test-install   one time: install the test tools and the Playwright browser
  make test           run the end-to-end tests
  make docker-up      run the demo in Docker at http://localhost:4173
  make docker-down    stop the Docker container
  make clean          delete test output`);
