import { initExpress } from './app'

const port = process.env.PORT || 8080

const app = initExpress()

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})
