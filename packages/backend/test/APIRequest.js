import { generateSignMessage, decryptRequestData } from "../middleware/encryptionUtils.js";


const APIReq = async (props)=>{
    const defaults = {
        url: "'http://localhost",
        path: "/",
        method: "GET",
        headers: {},
        body: {}
    }
    props = {...defaults, ...props}
    return await fetch(props.url + props.path, {
        method: props.method,
        headers: {
          'Content-Type': 'application/json', ...props.headers
        },
        body: JSON.stringify(props.body)
      })
        .then(response => response.json())
        .catch(error => console.error('Error:', error));
      
}

const username = 'test_user_'+Date.now()

const result = await APIReq({
    url: "http://localhost:3000",
    path: "/register",
    method: 'POST',
    body: {username:username}
})

if(!result.privateKey){
    throw Error('Problem while registering')
}else{
    console.log("Register successful: "+username)
}
const prvKey = result.privateKey

const result2 = await APIReq({
    url: "http://localhost:3000",
    path: "/protected",
    method: 'POST',
    body: generateSignMessage(username, {hey:"lo"}, prvKey)
})

console.log(result2)
console.log("\nDecrypting message:")
const result3 = decryptRequestData(result2.key, result2.encryptedMessage,prvKey)
console.log(result3)