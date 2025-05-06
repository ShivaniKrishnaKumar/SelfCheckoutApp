import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Button,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { CameraView, Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";

export default function App() {
  let cameraRef = useRef();
  const [hasCameraPermission, setHasCameraPermission] = useState();
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState();
  const [photo, setPhoto] = useState();
  const [scannedProduct, setScannedProduct] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [showBill, setShowBill] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true); // NEW

  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const mediaLibraryPermission =
        await MediaLibrary.requestPermissionsAsync();
      setHasCameraPermission(cameraPermission.status === "granted");
      setHasMediaLibraryPermission(mediaLibraryPermission.status === "granted");
    })();
  }, []);

  let takePic = async () => {
    let options = {
      quality: 1,
      base64: true,
      exif: false,
    };
    let newPhoto = await cameraRef.current.takePictureAsync(options);
    setPhoto(newPhoto);
    setLoading(true);
    await sendToYOLO(newPhoto.uri);
  };

  const sendToYOLO = async (imageUri) => {
    try {
      let formData = new FormData();
      formData.append("image", {
        uri: imageUri,
        name: "photo.jpg",
        type: "image/jpg",
      });

      const response = await fetch("http://192.168.99.131:8080", {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const result = await response.json();
      if (result.success && result.objects.length > 0) {
        const detectedObject = result.objects[0];

        const newProduct = {
          name: detectedObject.class,
          price: detectedObject.price || 0.0,
          confidence: detectedObject.confidence,
          id: Date.now(),
        };

        setScannedProduct(newProduct);
        setError(null);
        addToCart(newProduct);
      } else {
        setError(result.message || "No product detected. Please try again.");
        setScannedProduct(null);
      }
    } catch (error) {
      console.error("Detection error:", error);
      setError("Error connecting to YOLO model.");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart([...cart, product]);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price, 0);
  };

  const resetCart = () => {
    setCart([]);
    setShowBill(false);
  };

  const handlePrintBill = async () => {
    const groupedItems = {};

    cart.forEach((item) => {
      if (!groupedItems[item.name]) {
        groupedItems[item.name] = { name: item.name, quantity: 1 };
      } else {
        groupedItems[item.name].quantity += 1;
      }
    });

    const itemsToSend = Object.values(groupedItems);

    try {
      const response = await fetch("http://192.168.99.131:8080/print_bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: itemsToSend }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("Bill printed! Total: $" + result.total.toFixed(2));
        resetCart();
      } else {
        alert("Error printing bill: " + result.error);
      }
    } catch (error) {
      console.error("Print bill error:", error);
      alert("Failed to connect to server.");
    }
  };

  // 👋 Themed Welcome Page
  if (showWelcome) {
    return (
      <SafeAreaView style={styles.welcomeContainer}>
        <View style={styles.welcomeInner}>
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.appName}>Self Checkout App</Text>
          <Image
            source={require("./assets/grocery.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowWelcome(false)}
          >
            <Text style={styles.startButtonText}>Start Scanning</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (photo) {
    return (
      <SafeAreaView style={styles.container}>
        <Image style={styles.preview} source={{ uri: photo.uri }} />
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : scannedProduct ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>
              Product: {scannedProduct.name}
            </Text>
            <Text style={styles.resultText}>
              Price: ${scannedProduct.price.toFixed(2)}
            </Text>
            <Text style={styles.resultText}>Added to cart!</Text>

            <View style={styles.buttonRow}>
              <View style={styles.buttonWrapper}>
                <Button
                  title="Scan Another Item"
                  onPress={() => setPhoto(null)}
                />
              </View>
              <View style={styles.buttonWrapper}>
                <Button
                  title="View Cart"
                  onPress={() => setShowBill(true)}
                  color="green"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.resultContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.buttonWrapper}>
              <Button title="Try Again" onPress={() => setPhoto(null)} />
            </View>
          </View>
        )}

        <Modal visible={showBill} animationType="slide" transparent={false}>
          <View style={styles.modalContainer}>
            <Text style={styles.billHeader}>Your Bill</Text>

            <ScrollView style={styles.cartItemsContainer}>
              {cart.length > 0 ? (
                cart.map((item, index) => (
                  <View key={item.id} style={styles.cartItem}>
                    <Text style={styles.cartItemText}>
                      {index + 1}. {item.name} - ${item.price.toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeFromCart(item.id)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyCartText}>Your cart is empty</Text>
              )}
            </ScrollView>

            <View style={styles.totalContainer}>
              <Text style={styles.totalText}>
                Total: ${calculateTotal().toFixed(2)}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Continue Shopping"
                onPress={() => {
                  setShowBill(false);
                  setIsScanning(true);
                }}
              />
              <Button
                title="Print Bill"
                onPress={handlePrintBill}
                color="green"
              />
              <Button title="Clear Cart" onPress={resetCart} color="red" />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (hasCameraPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.fullScreen}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.cameraButtonContainer}>
          <Button title="Take Picture" onPress={takePic} />
          {cart.length > 0 && (
            <TouchableOpacity
              style={styles.cartBadge}
              onPress={() => setShowBill(true)}
            >
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.backHomeButton}
            onPress={() => setShowWelcome(true)}
          >
            <Text style={styles.backHomeText}>🏠 Back to Home</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  camera: {
    flex: 1,
  },
  cameraButtonContainer: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 15,
    borderRadius: 30,
  },
  preview: {
    width: "100%",
    height: "60%",
  },
  resultContainer: {
    padding: 20,
    width: "100%",
    backgroundColor: "white",
  },
  resultText: {
    fontSize: 18,
    marginVertical: 5,
  },
  errorText: {
    fontSize: 18,
    marginVertical: 5,
    color: "red",
  },
  buttonWrapper: {
    margin: 5,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  billHeader: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },
  cartItemsContainer: {
    flex: 1,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cartItemText: {
    fontSize: 16,
  },
  removeButton: {
    backgroundColor: "#ff4444",
    padding: 8,
    borderRadius: 5,
  },
  removeButtonText: {
    color: "white",
  },
  emptyCartText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 18,
    color: "#888",
  },
  totalContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  totalText: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "right",
  },
  modalButtons: {
    gap: 10,
    marginBottom: 20,
  },
  cartBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "red",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "white",
    fontWeight: "bold",
  },

  // 🎨 Themed Welcome Styles
  welcomeContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeInner: {
    alignItems: "center",
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    color: "#2f3640",
    fontWeight: "bold",
  },
  appName: {
    fontSize: 36,
    color: "#44bd32",
    fontWeight: "900",
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: "#44bd32",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  backHomeButton: {
    marginTop: 10,
    backgroundColor: "#2f3640",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
    alignSelf: "center",
  },
  backHomeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
