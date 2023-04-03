const express = require('express');
const { spawnSync } = require('child_process');
const { randomBytes } = require('crypto');

const app = express();
const port = 3000;

let password = '';

function generateRandHexString(length) {
  const bytes = randomBytes(length / 2);
  return bytes.toString('hex');
}

function generateRandMessage() {
  const length = Math.floor(Math.random() * 50) + 1;
  const bytes = randomBytes(length);
  return bytes.toString('hex');
}

function setPassword() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    const checkPassword = () => {
      readline.question('Enter a password for PFB: ', (password) => {
        readline.question('Confirm password: ', (confirmPassword) => {
          if (password !== confirmPassword) {
            console.log('Passwords do not match. Please try again.');
            checkPassword();
          } else {
            resolve(password);
            readline.close();
          }
        });
      });
    };
    checkPassword();
  });
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('views', './views');
app.set('view engine', 'ejs');

(async function() {
  password = await setPassword();
})();

app.get('/', (req, res) => {
  res.render('index.ejs');
});

app.post('/set_password', (req, res) => {
  const newPassword = req.body.password;
  const confirmPassword = req.body.confirm_password;
  if (newPassword === confirmPassword) {
    password = newPassword;
    res.send('Password set successfully.');
  } else {
    res.render('index.ejs', { message: 'Passwords do not match. Please try again.' });
  }
});

app.post('/submit', (req, res) => {
  if (req.body.password !== password) {
    res.render('index.ejs', { message: 'Incorrect password. Please try again.' });
    return;
  }

  const nId = generateRandHexString(16);
  const msg = generateRandMessage();

  const curlCmd = `curl -X POST -H 'Content-type: application/json' -d '{"namespace_id": "${nId}", "data": "${msg}", "gas_limit": 80000, "fee": 2000}' http://localhost:26659/submit_pfb`;
  const submitOutput = spawnSync(curlCmd, { shell: true });

  const submitResponse = JSON.parse(submitOutput.stdout);
  const height = submitResponse.height;
  const txhash = submitResponse.txhash;
  const logs = submitResponse.logs;
  const signer = logs[0].events[0].attributes[2].value.trim('"');

  const headerUrl = `http://localhost:26659/namespaced_shares/${nId}/height/${height}`;
  const headerCmd = `curl ${headerUrl}`;
  const headerOutput = spawnSync(headerCmd, { shell: true });

  const shareMsg = JSON.parse(headerOutput.stdout).shares[0];

  res.render('output.ejs', { nId, msg, height, txhash, shareMsg, signer });
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
