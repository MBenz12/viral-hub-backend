const app = require('./config/express')
const routes = require('./routes/index.route')
const socialCtr = require('./controllers/social.controller')

// Router
app.use('/api', routes)

// socialCtr.storeTelegram();
// socialCtr.storeTiktok();
// socialCtr.storeTwitter();
// socialCtr.storeInstagram();
// socialCtr.storeYoutube();

if (process.env.NODE_ENV === 'development') {
  app.listen(
    app.get('port'),
    () => {
      console.log(
        `Server running at http://${app.get('host')}:${app.get('port')}`
      )
    }
  )
} else {
  // 
}