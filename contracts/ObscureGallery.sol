// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ObscureGallery
/// @notice Stores encrypted image metadata with FHE-protected addresses.
contract ObscureGallery is ZamaEthereumConfig {
    struct ImageEntry {
        string fileName;
        string encryptedIpfsHash;
        eaddress encryptedAddress;
    }

    mapping(address => ImageEntry[]) private _images;

    event ImageStored(address indexed user, uint256 index, string fileName, string encryptedIpfsHash);

    error EmptyFileName();
    error EmptyEncryptedHash();
    error InvalidIndex(uint256 index, uint256 length);

    /// @notice Store an image metadata entry for the sender.
    /// @param fileName The original file name.
    /// @param encryptedIpfsHash The IPFS hash encrypted off-chain.
    /// @param encryptedAddress The FHE-encrypted address used to encrypt the hash.
    /// @param inputProof Proof of the encrypted input.
    function addImage(
        string calldata fileName,
        string calldata encryptedIpfsHash,
        externalEaddress encryptedAddress,
        bytes calldata inputProof
    ) external {
        if (bytes(fileName).length == 0) {
            revert EmptyFileName();
        }
        if (bytes(encryptedIpfsHash).length == 0) {
            revert EmptyEncryptedHash();
        }

        eaddress storedAddress = FHE.fromExternal(encryptedAddress, inputProof);
        _images[msg.sender].push(ImageEntry(fileName, encryptedIpfsHash, storedAddress));

        FHE.allowThis(storedAddress);
        FHE.allow(storedAddress, msg.sender);

        emit ImageStored(msg.sender, _images[msg.sender].length - 1, fileName, encryptedIpfsHash);
    }

    /// @notice Returns how many images a user has stored.
    /// @param user The address to query.
    function getImageCount(address user) external view returns (uint256) {
        return _images[user].length;
    }

    /// @notice Returns a single image entry for a user.
    /// @param user The address to query.
    /// @param index The index within the user's list.
    function getImage(address user, uint256 index)
        external
        view
        returns (string memory fileName, string memory encryptedIpfsHash, eaddress encryptedAddress)
    {
        uint256 length = _images[user].length;
        if (index >= length) {
            revert InvalidIndex(index, length);
        }

        ImageEntry storage entry = _images[user][index];
        return (entry.fileName, entry.encryptedIpfsHash, entry.encryptedAddress);
    }
}
