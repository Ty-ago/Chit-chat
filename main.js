import './style.css'



// import firebase from 'firebase/app';

// import 'firebase/firestore';

// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyBwgtEwzJYoRil4PWJWIWX_oloPodnNpuo",
//   authDomain: "chit-chat-78fa9.firebaseapp.com",
//   projectId: "chit-chat-78fa9",
//   storageBucket: "chit-chat-78fa9.appspot.com",
//   messagingSenderId: "315296300638",
//   appId: "1:315296300638:web:bf52f958d1cf6ec7f3becf",
//   measurementId: "G-NZPW6M2YW3"
// };

// if (!firebase.getApps.length) {
//   firebase.initializeApp(firebaseConfig);
// };

// const firestore = firebase.firestore();







// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBwgtEwzJYoRil4PWJWIWX_oloPodnNpuo",
  authDomain: "chit-chat-78fa9.firebaseapp.com",
  projectId: "chit-chat-78fa9",
  storageBucket: "chit-chat-78fa9.appspot.com",
  messagingSenderId: "315296300638",
  appId: "1:315296300638:web:5d9d0e9b20d01477f3becf",
  measurementId: "G-X5QV65EY7X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);





const servers = {

  iceServers: [
    {
      urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,

};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream= null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');



// 1. Setup media sources
webcamButton.onclick = async () => {
  
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from Local stream to peer connection
  localStream.getTracks().forEach((track) => {
    
    pc.addTrack(track, localStream);
  
  });

  pc.ontrack = event => {
    
    event.streams[0].getTracks().forEach(track => {

      remoteStream.addTrack(track);

    });

  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

};



// 2. Create an offer
callButton.onclick = async () => {
  
  // Reference Firestore Collection
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  // setup listener before setLocalDescription
  pc.onicecandidate = event => {

    event.candidate && offerCandidates.add(event.candidate.toJSON());

  };


  // Create an offer and save it to the db
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {

    sdp: offerDescription.sdp,
    type: offerDescription.type,

  };

  await callDoc.set({ offer });

  
  // Listen for remote answer (changes in firestore)
  callDoc.onSnapshot((snapshot) => {

    const data = snapshot.data();

    if (!pc.currentRemoteDescription && data?.answer) {

      // Fires when someone answers the call
      const answerDescription = new RTCSessionDescription(data.answer);

      pc.setRemoteDescription(answerDescription);

    }

  });

  // When answered (updates are made to the ICE candidate collection), add candidate to peer connection
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {

      if (change.type === 'added') {

        const candidate = new RTCIceCandidate(change.doc.data());

        pc.addIceCandidate(candidate);

      }
    });
  });
};



// 3. Answer the call with the unique ID
answerButton.onclick = async () => {

  //making a reference to the document
  const callId = callInput.value;
  
  const callDoc = firestore.collection('calls').doc(callId);

  const answerCandidates = callDoc.collection('answerCandidates');

  //making a reference to the answer candidates collection
  pc.onicecandidate = event => {

    event.candidate && answerCandidates.add(event.candidate.toJSON());

  };

  // Fetch the 'call' document from the db and grab its data
  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;

  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();

  await pc.setLocalDescription(answerDescription);

  const answer ={

    type: answerDescription.type,
    sdp: answerDescription.sdp,

  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {

    snapshot.docChanges().forEach((change) => {

      console.log(change)

      if (change.type === 'added'){

        let data = change.doc.data();

        pc.addIceCandidate(new RTCIceCandidate(data));

      }

    });

  });

};
