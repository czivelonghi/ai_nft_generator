import { useState, useEffect } from 'react';
import { NFTStorage, File } from 'nft.storage'
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import axios from 'axios';

// Components
import Spinner from 'react-bootstrap/Spinner';
import Navigation from './components/Navigation';

// ABIs
import NFT from './abis/NFT.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState(null)
  const [nft, setNFT] = useState(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState(null)
  const [url, setURL] = useState(null)

  const [message, setMessage] = useState('')
  const [isWaiting, setWaiting] = useState(false)

  const loadBlockchainData = async () => {
    console.log('loadBlockchainData')

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    const network = await provider.getNetwork()

    const nft = new ethers.Contract(config[network.chainId].nft.address, NFT, provider)
    setNFT(nft)

    const name = await nft.name()

    console.log('name', name)
  }

  const submitHandler = async (e) =>{
    e.preventDefault() //stops page from refreshing

    if(name === '' || description === ''){
      window.alert('Please enter name and description')
      return
    }

    setWaiting(true)

    const imageData = createImage()

    const url = await uploadImage(imageData)

    await mintImage(url)

    setWaiting(false)
    setMessage('')
  }

  const createImage = async() =>{
    setMessage('Creating Image...')
    
    const URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2'

    const response = await axios({
      url: URL,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({inputs: description, options: { wait_for_model: true }, }),
      responseType: 'arraybuffer',
    })

    const type = response.headers['content-type']
    const data = response.data

    const base64data = Buffer.from(data).toString('base64')
    const image = `data:${type};base64,` + base64data
    setImage(image)

    return data
  }
  
  const uploadImage = async (imageData) =>{
    setMessage('Uploading Image...')

    const nftstorage = new NFTStorage({ token: process.env.REACT_APP_NFT_STORAGE_API_KEY })

    const { ipnft } = await nftstorage.store({
      image: new File([imageData], 'image.jpeg', {type: 'image/jpeg'}),
      name: name,
      description: description,
    })

    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`
    setURL(url)

    return url
  }

  const mintImage = async(tokenURI) =>{
    setMessage('Waiting for Mint...')

    const signer = await provider.getSigner()
    const transaction = await nft.connect(signer).mint(tokenURI, {value: ethers.utils.parseUnits("1", "ether")})
    await transaction.wait()
  } 

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <p>Edit App.js to get started!</p>
      <div className='form'>

        <form onSubmit={submitHandler}>
          <input type="text" placeholder='create a name...' onChange={(e) => {setName(e.target.value)}}></input>
          <input type="text" placeholder='create a desc...' onChange={(e) => {setDescription(e.target.value)}}></input>
          <input type="submit" value='create and mint'></input>
        </form>
        
        <div className='image'>
          {!isWaiting && image ? (
            <img src={image} alt='AI Generated Image' />
          ) : isWaiting ?(
            <div className='image__placeholder'>
              <Spinner animation='border'/>
              <p>{message}</p>
            </div>
          ) :(
            <></>
          )}
        </div>

      </div>
      {!isWaiting && url && (
        <p>View &nbsp;<a href={url} target='_blank' rel='noreferrer'>Metadata</a></p>
      )}
      
    </div>
  );
}

export default App;
