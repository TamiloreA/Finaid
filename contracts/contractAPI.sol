// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract UserSignup {
    struct User {
        string firstName;
        string lastName;
        string phone;
        string email;
        uint256 age;
        string profilePictureHash; // Store the IPFS hash or equivalent for the profile picture
    }

    mapping(address => User) private users;
    mapping(address => bool) private registered;

    event UserRegistered(address indexed userAddress, string email);

    // Register a new user
    function registerUser(
        string memory _firstName,
        string memory _lastName,
        string memory _phone,
        string memory _email,
        uint256 _age,
        string memory _profilePictureHash
    ) public {
        require(!registered[msg.sender], "User already registered");
        require(_age > 0, "Age must be greater than 0");
        require(bytes(_email).length > 0, "Email is required");

        users[msg.sender] = User({
            firstName: _firstName,
            lastName: _lastName,
            phone: _phone,
            email: _email,
            age: _age,
            profilePictureHash: _profilePictureHash
        });

        registered[msg.sender] = true;

        emit UserRegistered(msg.sender, _email);
    }

    // Fetch user details
    function getUser(address _userAddress)
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            string memory,
            uint256,
            string memory
        )
    {
        require(registered[_userAddress], "User not registered");
        User memory user = users[_userAddress];
        return (
            user.firstName,
            user.lastName,
            user.phone,
            user.email,
            user.age,
            user.profilePictureHash
        );
    }
}
