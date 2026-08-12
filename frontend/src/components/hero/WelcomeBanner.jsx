function WelcomeBanner() {

    const isLoggedIn = false;

    return (

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl text-white p-5 shadow-lg">

            {

                isLoggedIn ? (

                    <>

                        <p className="text-sm opacity-90">

                            Welcome Back 👋

                        </p>

                        <h2 className="text-2xl font-black mt-1">

                            Ready to order today?

                        </h2>

                    </>

                ) : (

                    <>

                        <p className="text-sm opacity-90">

                            Welcome 👋

                        </p>

                        <h2 className="text-2xl font-black mt-1">

                            Discover Food Near You

                        </h2>

                    </>

                )

            }

        </div>

    );

}

export default WelcomeBanner;